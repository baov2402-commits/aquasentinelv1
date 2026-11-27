import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  GitBranch,
  Moon,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Sun,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from 'lucide-react';
import { DeployVercelModal } from './components/DeployVercelModal';
import { LoginScreen } from './components/LoginScreen';
import { PoolCanvas } from './components/PoolCanvas';
import { TelemetryChart } from './components/TelemetryChart';
import type {
  AuthUser,
  ConnMode,
  LayoutMode,
  LogEntry,
  PoolConfig,
  SafetyMode,
  SwimPattern,
  Swimmer,
} from './types/aquasentinel';
import { playAlertBeep } from './utils/audio';

const DEFAULT_NAMES = [
  'Nguyễn Minh Anh',
  'Trần Gia Bảo',
  'Lê Thảo Vy',
  'Phạm Đức Huy',
  'Hoàng Khánh Linh',
  'Vũ Quốc Anh',
  'Đặng Ngọc Hân',
  'Bùi Tuấn Kiệt',
];

const SESSION_KEY = 'aquasentinel_session_v1';

function createInitialSwimmers(pool: PoolConfig): Swimmer[] {
  return DEFAULT_NAMES.slice(0, 5).map((name, idx) => ({
    id: `AS-${String(idx + 1).padStart(2, '0')}`,
    name,
    x: 2.5 + ((idx * 4.1) % Math.max(4, pool.length - 5)),
    y: 1.8 + ((idx * 2.3) % Math.max(3, pool.width - 3.6)),
    angle: (idx * 1.15) % (Math.PI * 2),
    speed: 0.55 + (idx % 3) * 0.12,
    turnPhase: idx * 1.7,
    mode: 'normal',
    status: 'safe',
    accelMag: 1.05,
    pitch: 10,
    battery: 85 + ((idx * 3) % 14),
    anomalyTimer: 0,
    phase: idx * 1.2,
  }));
}

function getDepthAt(x: number, pool: PoolConfig): number {
  const r = Math.min(Math.max(x / pool.length, 0), 1);
  return pool.minDepth + r * (pool.maxDepth - pool.minDepth);
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
      return saved ? (JSON.parse(saved) as AuthUser) : null;
    } catch {
      return null;
    }
  });
  const [deployModalOpen, setDeployModalOpen] = useState(false);

  // Default to bright blue-and-white translucent theme
  const [darkMode, setDarkMode] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('split');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [paused, setPaused] = useState(false);
  const [clockStr, setClockStr] = useState(() => new Date().toTimeString().slice(0, 8));

  const [pool, setPool] = useState<PoolConfig>({
    length: 25.0,
    width: 12.5,
    minDepth: 1.1,
    maxDepth: 1.8,
    lanes: 5,
  });
  const [swimPattern, setSwimPattern] = useState<SwimPattern>('free');
  const [swimmers, setSwimmers] = useState<Swimmer[]>(() =>
    createInitialSwimmers({
      length: 25.0,
      width: 12.5,
      minDepth: 1.1,
      maxDepth: 1.8,
      lanes: 5,
    })
  );
  const nextIdRef = useRef(6);
  const [selectedId, setSelectedId] = useState<string | null>('AS-01');
  const [newSwimmerName, setNewSwimmerName] = useState('');
  const [telemetryHistory, setTelemetryHistory] = useState<number[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>(() => [
    {
      id: 'init-1',
      ts: new Date().toTimeString().slice(0, 8),
      message: 'Hệ thống sẵn sàng giám sát 5 người bơi.',
      level: 'info',
    },
  ]);

  const [connMode, setConnMode] = useState<ConnMode>('sim');
  const [espUrl, setEspUrl] = useState('ws://192.168.1.50:81');
  const [espConnected, setEspConnected] = useState(false);
  const [espStatusLabel, setEspStatusLabel] = useState('MÔ PHỎNG');
  const [espError, setEspError] = useState(false);
  const espSocketRef = useRef<WebSocket | null>(null);
  const espPollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const addLog = useCallback((message: string, level: LogEntry['level'] = 'info') => {
    const ts = new Date().toTimeString().slice(0, 8);
    setLogs((prev) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ts, message, level },
      ...prev.slice(0, 20),
    ]);
  }, []);

  const handleLoginSuccess = (loggedUser: AuthUser, remember: boolean) => {
    setUser(loggedUser);
    if (remember) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(loggedUser));
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(loggedUser));
      localStorage.removeItem(SESSION_KEY);
    }
    addLog(`Đăng nhập: ${loggedUser.name}.`);
  };

  const handleLogout = () => {
    setDeployModalOpen(false);
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  };

  const disconnectEsp = useCallback(
    (keepError = false) => {
      if (espSocketRef.current) {
        espSocketRef.current.close();
        espSocketRef.current = null;
      }
      if (espPollTimerRef.current !== null) {
        window.clearInterval(espPollTimerRef.current);
        espPollTimerRef.current = null;
      }
      setEspConnected(false);
      if (!keepError) {
        setEspError(false);
        setEspStatusLabel(connMode === 'esp32' ? 'CHỜ KẾT NỐI' : 'MÔ PHỎNG');
      }
    },
    [connMode]
  );

  const handleEspPayload = useCallback(
    (data: { id?: string; accel?: number; pitch?: number; bat?: number; sos?: number | boolean }) => {
      setSwimmers((prev) =>
        prev.map((s) => {
          const targetId = data.id || selectedId;
          if (s.id !== targetId) return s;

          const nextAccel = typeof data.accel === 'number' ? data.accel : s.accelMag;
          const nextPitch = typeof data.pitch === 'number' ? data.pitch : s.pitch;
          const nextBat = typeof data.bat === 'number' ? data.bat : s.battery;
          let nextMode = s.mode;
          let nextStatus = s.status;

          if (data.sos === 1 || data.sos === true) {
            nextMode = 'sos';
            nextStatus = 'danger';
          } else if (nextAccel > 2.2 || Math.abs(nextPitch) > 60) {
            nextMode = 'thrashing';
            nextStatus = 'warn';
          } else {
            nextMode = 'normal';
            nextStatus = 'safe';
          }

          return {
            ...s,
            accelMag: nextAccel,
            pitch: nextPitch,
            battery: nextBat,
            mode: nextMode,
            status: nextStatus,
          };
        })
      );
    },
    [selectedId]
  );

  const handleConnModeChange = (nextMode: ConnMode) => {
    setConnMode(nextMode);
    if (nextMode === 'sim') {
      disconnectEsp(false);
      setEspError(false);
      setEspStatusLabel('MÔ PHỎNG');
    } else {
      setEspError(false);
      setEspStatusLabel(espConnected ? 'ONLINE' : 'CHỜ KẾT NỐI');
    }
  };

  const toggleEspConnection = () => {
    if (espConnected) {
      disconnectEsp(false);
      return;
    }
    const cleanUrl = espUrl.trim();
    if (!cleanUrl) return;

    setEspError(false);
    setEspStatusLabel('ĐANG NỐI...');

    if (cleanUrl.startsWith('ws://') || cleanUrl.startsWith('wss://')) {
      try {
        const ws = new WebSocket(cleanUrl);
        espSocketRef.current = ws;
        ws.onopen = () => {
          setEspConnected(true);
          setEspError(false);
          setEspStatusLabel('ONLINE (WS)');
          addLog(`Kết nối ESP32: ${cleanUrl}`);
        };
        ws.onmessage = (msg) => {
          try {
            handleEspPayload(JSON.parse(msg.data));
          } catch {
            // Ignore malformed JSON
          }
        };
        ws.onerror = () => {
          setEspError(true);
          setEspStatusLabel('LỖI MẠNG');
          addLog(`Lỗi kết nối ESP32`, 'warn');
          disconnectEsp(true);
        };
        ws.onclose = () => {
          if (espSocketRef.current === ws) {
            disconnectEsp(false);
          }
        };
      } catch {
        setEspError(true);
        setEspStatusLabel('URL SAI');
      }
    } else {
      setEspConnected(true);
      setEspError(false);
      setEspStatusLabel('ONLINE (HTTP)');
      addLog(`Đọc HTTP ESP32: ${cleanUrl}`);
      espPollTimerRef.current = window.setInterval(async () => {
        try {
          const res = await fetch(cleanUrl);
          const payload = await res.json();
          handleEspPayload(payload);
        } catch {
          setEspError(true);
          setEspStatusLabel('MẤT TÍN HIỆU');
        }
      }, 500);
    }
  };

  useEffect(() => {
    return () => {
      if (espSocketRef.current) espSocketRef.current.close();
      if (espPollTimerRef.current !== null) window.clearInterval(espPollTimerRef.current);
    };
  }, []);

  const simRefs = useRef({
    pool,
    swimPattern,
    paused,
    connMode,
    espConnected,
    selectedId,
  });
  simRefs.current = { pool, swimPattern, paused, connMode, espConnected, selectedId };

  useEffect(() => {
    if (!user) return;

    let lastNow = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.08, (now - lastNow) / 1000);
      lastNow = now;
      const timeSec = now / 1000;

      setClockStr(new Date().toTimeString().slice(0, 8));

      const {
        pool: curPool,
        swimPattern: curPattern,
        paused: isPaused,
        connMode: curConn,
        espConnected: isEspOnline,
        selectedId: curSelId,
      } = simRefs.current;

      if (isPaused) return;

      setSwimmers((prev) => {
        const updated = prev.map((s, i) => {
          const nextPhase = s.phase + dt * 3.2;
          const isLiveEsp = curConn === 'esp32' && isEspOnline && s.id === curSelId;

          let nextX = s.x;
          let nextY = s.y;
          let nextAngle = s.angle;
          let nextStatus = s.status;
          let nextAccel = s.accelMag;
          let nextPitch = s.pitch;
          let nextAnomalyTimer = s.anomalyTimer;

          if (s.mode === 'normal') {
            nextStatus = 'safe';
            if (curPattern === 'free') {
              nextAngle += Math.sin(timeSec * 0.65 + s.turnPhase) * 0.55 * dt;
              let vx = Math.cos(nextAngle);
              let vy = Math.sin(nextAngle);
              const margin = 1.6;
              const turnForce = 2.8 * dt;
              if (nextX < margin) vx += turnForce * (margin - nextX);
              if (nextX > curPool.length - margin) vx -= turnForce * (nextX - (curPool.length - margin));
              if (nextY < margin) vy += turnForce * (margin - nextY);
              if (nextY > curPool.width - margin) vy -= turnForce * (nextY - (curPool.width - margin));
              nextAngle = Math.atan2(vy, vx);
              nextX += Math.cos(nextAngle) * s.speed * dt;
              nextY += Math.sin(nextAngle) * s.speed * dt;
            } else {
              const laneH = curPool.width / curPool.lanes;
              const targetY = laneH * ((i % curPool.lanes) + 0.5);
              nextY += (targetY - nextY) * Math.min(1, dt * 3);
              const dirX = Math.cos(nextAngle) >= 0 ? 1 : -1;
              nextX += dirX * s.speed * dt;
              nextAngle = dirX === 1 ? 0 : Math.PI;
              if (nextX > curPool.length - 1.3) {
                nextX = curPool.length - 1.3;
                nextAngle = Math.PI;
              }
              if (nextX < 1.3) {
                nextX = 1.3;
                nextAngle = 0;
              }
            }
            nextX = Math.min(Math.max(nextX, 0.8), curPool.length - 0.8);
            nextY = Math.min(Math.max(nextY, 0.8), curPool.width - 0.8);

            if (!isLiveEsp) {
              nextAccel = 1.05 + 0.28 * Math.sin(nextPhase);
              nextPitch = 10 + 6 * Math.sin(nextPhase * 0.7);
            }
          } else if (s.mode === 'thrashing') {
            nextAnomalyTimer += dt;
            if (!isLiveEsp) {
              nextAccel = 1.85 + Math.abs(Math.sin(timeSec * 14 + nextPhase)) * 1.4;
              nextPitch = 72 + 12 * Math.sin(timeSec * 9);
            }
            nextStatus = nextAnomalyTimer > 6.0 ? 'danger' : 'warn';
          } else if (s.mode === 'immobile') {
            nextAnomalyTimer += dt;
            nextStatus = 'danger';
            if (!isLiveEsp) {
              nextAccel = 0.99 + (Math.random() - 0.5) * 0.03;
              nextPitch = 4;
            }
          } else if (s.mode === 'sos') {
            nextAnomalyTimer += dt;
            nextStatus = 'danger';
            if (!isLiveEsp) {
              nextAccel = 1.4 + 0.5 * Math.sin(timeSec * 8);
              nextPitch = 60 + 14 * Math.sin(timeSec * 5);
            }
          }

          return {
            ...s,
            x: nextX,
            y: nextY,
            angle: nextAngle,
            phase: nextPhase,
            status: nextStatus,
            accelMag: nextAccel,
            pitch: nextPitch,
            anomalyTimer: nextAnomalyTimer,
          };
        });

        const sel = updated.find((item) => item.id === curSelId);
        if (sel) {
          setTelemetryHistory((hist) => {
            const next = [...hist, sel.accelMag];
            return next.length > 85 ? next.slice(next.length - 85) : next;
          });
        }

        return updated;
      });
    }, 50);

    return () => window.clearInterval(timer);
  }, [user]);

  const dangers = useMemo(() => swimmers.filter((s) => s.status === 'danger'), [swimmers]);
  const warns = useMemo(() => swimmers.filter((s) => s.status === 'warn'), [swimmers]);

  useEffect(() => {
    if (!user) return;
    if (dangers.length > 0) {
      playAlertBeep(true, soundEnabled);
    } else if (warns.length > 0) {
      playAlertBeep(false, soundEnabled);
    }
  }, [dangers.length, warns.length, soundEnabled, user, swimmers]);

  const selectedSwimmer = useMemo(
    () => swimmers.find((s) => s.id === selectedId) || swimmers[0] || null,
    [swimmers, selectedId]
  );

  const chartPeak = useMemo(() => {
    if (telemetryHistory.length === 0) return 0;
    return Math.max(...telemetryHistory);
  }, [telemetryHistory]);

  const handleSelectSwimmer = (id: string) => {
    setSelectedId(id);
    setTelemetryHistory([]);
  };

  const handleAddSwimmer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const num = nextIdRef.current++;
    const name =
      newSwimmerName.trim() || DEFAULT_NAMES[(num - 1) % DEFAULT_NAMES.length];
    const id = `AS-${String(num).padStart(2, '0')}`;
    setNewSwimmerName('');

    const added: Swimmer = {
      id,
      name,
      x: 2.0 + Math.random() * Math.max(2, pool.length - 4),
      y: 1.5 + Math.random() * Math.max(2, pool.width - 3),
      angle: Math.random() * Math.PI * 2,
      speed: 0.55 + Math.random() * 0.25,
      turnPhase: Math.random() * 10,
      mode: 'normal',
      status: 'safe',
      accelMag: 1.04,
      pitch: 10,
      battery: 85 + ((swimmers.length * 3) % 14),
      anomalyTimer: 0,
      phase: swimmers.length * 1.2,
    };

    setSwimmers((prev) => [...prev, added]);
    if (!selectedId) setSelectedId(id);
    addLog(`Thêm ${id} (${name}).`);
  };

  const handleRemoveSwimmer = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (swimmers.length <= 1) return;
    setSwimmers((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (selectedId === id) {
        setSelectedId(next[0]?.id || null);
        setTelemetryHistory([]);
      }
      return next;
    });
  };

  const triggerScenario = (mode: SafetyMode) => {
    if (!selectedSwimmer) return;
    const targetId = selectedSwimmer.id;

    setSwimmers((prev) =>
      prev.map((s) => {
        if (s.id !== targetId) return s;
        return {
          ...s,
          mode,
          anomalyTimer: 0,
          status: mode === 'normal' ? 'safe' : mode === 'thrashing' ? 'warn' : 'danger',
        };
      })
    );

    if (mode === 'normal') addLog(`${targetId}: An toàn.`);
    else if (mode === 'thrashing') addLog(`${targetId}: Vùng vẫy!`, 'warn');
    else if (mode === 'immobile') addLog(`${targetId}: Bất động!`, 'danger');
    else addLog(`${targetId}: NÚT SOS!`, 'danger');
  };

  const resetAllSwimmers = () => {
    setSwimmers((prev) =>
      prev.map((s) => ({ ...s, mode: 'normal', status: 'safe', anomalyTimer: 0 }))
    );
    addLog('Đặt lại tất cả an toàn.');
  };

  const acknowledgeAlert = () => {
    const firstAlert = swimmers.find((s) => s.status !== 'safe');
    if (!firstAlert) return;
    setSwimmers((prev) =>
      prev.map((s) =>
        s.id === firstAlert.id
          ? { ...s, mode: 'normal', status: 'safe', anomalyTimer: 0 }
          : s
      )
    );
    addLog(`Đã hỗ trợ ${firstAlert.id}.`);
  };

  const applyPoolPreset = (len: number, wid: number, maxDepth: number) => {
    const minDepth = Math.max(0.8, Number((maxDepth * 0.62).toFixed(1)));
    setPool((prev) => ({ ...prev, length: len, width: wid, maxDepth, minDepth }));
    setSwimmers((prev) =>
      prev.map((s) => ({
        ...s,
        x: Math.min(Math.max(s.x, 1.2), len - 1.2),
        y: Math.min(Math.max(s.y, 1.0), wid - 1.0),
      }))
    );
  };

  const updatePoolDimension = (field: 'length' | 'width' | 'maxDepth', val: number) => {
    setPool((prev) => {
      const next = { ...prev, [field]: val };
      next.minDepth = Math.max(0.8, Number((next.maxDepth * 0.62).toFixed(1)));
      return next;
    });
    if (field === 'length') {
      setSwimmers((prev) => prev.map((s) => ({ ...s, x: Math.min(s.x, val - 1) })));
    } else if (field === 'width') {
      setSwimmers((prev) => prev.map((s) => ({ ...s, y: Math.min(s.y, val - 0.8) })));
    }
  };

  if (!user) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode((d) => !d)}
      />
    );
  }

  // Crystal-transparent blue & white frosted glass surfaces
  const glassPanelClass =
    'rounded-3xl border border-white/65 dark:border-sky-300/25 bg-white/28 dark:bg-sky-950/30 backdrop-blur-2xl shadow-[0_12px_36px_rgba(2,132,199,0.14),inset_0_1px_0_rgba(255,255,255,0.68)] dark:shadow-[0_14px_38px_rgba(2,16,36,0.45)]';
  const innerCardClass =
    'rounded-2xl border border-white/55 dark:border-sky-300/20 bg-white/22 dark:bg-sky-950/25 backdrop-blur-md';

  const postureInfo = !selectedSwimmer
    ? { title: 'Chưa chọn', desc: 'Click người bơi' }
    : selectedSwimmer.mode === 'normal'
    ? { title: 'Bơi ổn định', desc: 'Chuyển động đều' }
    : selectedSwimmer.mode === 'thrashing'
    ? { title: 'Vùng vẫy mạnh', desc: 'Rung lắc bất thường' }
    : selectedSwimmer.mode === 'immobile'
    ? {
        title: 'Bất động',
        desc: `Đứng yên ${selectedSwimmer.anomalyTimer.toFixed(1)}s`,
      }
    : { title: 'Khẩn cấp SOS', desc: 'Cần hỗ trợ ngay' };

  const activeAlertSwimmer = dangers[0] || warns[0] || null;

  return (
    <div
      className={`relative min-h-screen lg:h-screen flex flex-col p-2.5 sm:p-3.5 gap-3 lg:overflow-hidden transition-colors duration-200 ${
        darkMode
          ? 'bg-gradient-to-br from-sky-950 via-blue-950 to-slate-950 text-slate-100'
          : 'bg-gradient-to-br from-sky-400/80 via-sky-200 to-white text-sky-950'
      }`}
    >
      {/* Ambient aquatic light spheres visible through transparent glass */}
      <div className="pointer-events-none fixed -top-24 -left-24 w-96 h-96 rounded-full bg-sky-400/45 dark:bg-sky-500/25 blur-3xl" />
      <div className="pointer-events-none fixed top-1/3 -right-24 w-96 h-96 rounded-full bg-cyan-300/45 dark:bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-24 left-1/3 w-96 h-96 rounded-full bg-blue-400/35 dark:bg-cyan-400/15 blur-3xl" />

      {/* TOP BAR */}
      <header
        className={`relative z-10 ${glassPanelClass} px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 shrink-0`}
      >
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center font-mono font-bold text-xs text-white shadow-[0_4px_14px_rgba(14,165,233,0.4)]">
            AS
          </div>
          <span className="text-base font-bold tracking-tight whitespace-nowrap text-sky-950 dark:text-white">
            AquaSentinel
          </span>
        </div>

        {/* Layout Tabs */}
        <div className="flex items-center p-1 rounded-2xl bg-white/30 dark:bg-sky-950/45 border border-white/60 dark:border-sky-300/20 gap-1">
          {(
            [
              { id: 'split', label: '2 phần' },
              { id: 'view', label: 'Bảng xem' },
              { id: 'ctrl', label: 'Điều khiển' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setLayoutMode(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                layoutMode === tab.id
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-[0_3px_12px_rgba(14,165,233,0.35)]'
                  : 'text-sky-900/70 dark:text-sky-100/75 hover:text-sky-950 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={`px-3 py-1.5 rounded-2xl border text-xs font-mono font-bold flex items-center gap-1.5 whitespace-nowrap ${
              dangers.length > 0
                ? 'bg-red-500/20 border-red-400/60 text-red-700 dark:text-red-200'
                : warns.length > 0
                ? 'bg-amber-500/20 border-amber-400/60 text-amber-800 dark:text-amber-200'
                : 'bg-emerald-500/15 border-emerald-400/50 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                dangers.length > 0
                  ? 'bg-red-500 animate-ping'
                  : warns.length > 0
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-emerald-500'
              }`}
            />
            <span>
              {dangers.length > 0
                ? `CẢNH BÁO (${dangers.length})`
                : warns.length > 0
                ? `CHÚ Ý (${warns.length})`
                : 'AN TOÀN'}
            </span>
          </div>

          <div className="px-2.5 py-1.5 rounded-2xl border border-white/60 dark:border-sky-300/20 bg-white/30 dark:bg-sky-950/35 font-mono text-xs font-semibold whitespace-nowrap text-sky-950 dark:text-sky-100">
            {clockStr}
          </div>

          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            className="px-2.5 py-1.5 rounded-2xl border border-white/60 dark:border-sky-300/20 bg-white/30 dark:bg-sky-950/35 hover:bg-white/50 dark:hover:bg-sky-900/45 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            {darkMode ? (
              <Sun className="w-3.5 h-3.5 text-amber-300" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-sky-700" />
            )}
            <span>{darkMode ? 'Sáng' : 'Tối'}</span>
          </button>

          <button
            type="button"
            onClick={() => setSoundEnabled((s) => !s)}
            className={`px-2.5 py-1.5 rounded-2xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all ${
              soundEnabled
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 border-sky-400 text-white shadow-[0_3px_12px_rgba(14,165,233,0.35)]'
                : 'border-white/60 dark:border-sky-300/20 bg-white/30 dark:bg-sky-950/35 text-sky-900/75 dark:text-slate-300'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{soundEnabled ? 'Còi: BẬT' : 'Còi: TẮT'}</span>
          </button>

          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className={`px-2.5 py-1.5 rounded-2xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all ${
              paused
                ? 'bg-amber-500/25 border-amber-400 text-amber-900 dark:text-amber-200'
                : 'border-white/60 dark:border-sky-300/20 bg-white/30 dark:bg-sky-950/35 hover:bg-white/50 dark:hover:bg-sky-900/45'
            }`}
          >
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{paused ? 'Tiếp' : 'Dừng'}</span>
          </button>

          <button
            type="button"
            onClick={() => setDeployModalOpen(true)}
            className="px-3 py-1.5 rounded-2xl border border-white/65 dark:border-sky-300/25 bg-white/35 dark:bg-sky-500/20 hover:bg-white/55 text-xs font-semibold text-sky-900 dark:text-sky-100 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            title="Tài khoản & Triển khai Vercel"
          >
            <GitBranch className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span className="max-w-[100px] truncate">{user.name}</span>
          </button>
        </div>
      </header>

      {/* WORKSPACE */}
      <main
        className={`relative z-10 flex-1 min-h-0 grid gap-3 ${
          layoutMode === 'split'
            ? 'grid-cols-1 lg:grid-cols-[1fr_340px]'
            : 'grid-cols-1'
        }`}
      >
        {/* ==================== PHẦN 1: BẢNG XEM ==================== */}
        {layoutMode !== 'ctrl' && (
          <section className="flex flex-col gap-3 min-h-0">
            <div className={`${glassPanelClass} flex-1 flex flex-col min-h-0 overflow-hidden`}>
              {/* Compact Header + Specs */}
              <div className="px-4 py-2.5 border-b border-white/45 dark:border-sky-300/15 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-bold text-sky-950 dark:text-white flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-sky-500" />
                    <span>Hồ bơi giám sát</span>
                  </span>
                  <span className="font-mono text-slate-600 dark:text-sky-200/80">
                    {pool.length}×{pool.width}m · Sâu {pool.minDepth.toFixed(1)}–{pool.maxDepth.toFixed(1)}m · {swimmers.length} người
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-sky-100/80">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    An toàn
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Chú ý
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Nguy hiểm
                  </span>
                </div>
              </div>

              {/* Pool Canvas */}
              <PoolCanvas
                pool={pool}
                swimmers={swimmers}
                selectedId={selectedSwimmer?.id || null}
                swimPattern={swimPattern}
                darkMode={darkMode}
                onSelectSwimmer={handleSelectSwimmer}
              />

              {/* Emergency Alert Strip */}
              {activeAlertSwimmer && (
                <div className="mx-3 mb-3 px-4 py-2.5 rounded-2xl bg-red-500 text-white flex flex-wrap items-center justify-between gap-2 shadow-lg shrink-0">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      {activeAlertSwimmer.id} ({activeAlertSwimmer.name}):{' '}
                      {activeAlertSwimmer.mode === 'sos'
                        ? 'NÚT SOS'
                        : activeAlertSwimmer.mode === 'immobile'
                        ? 'BẤT ĐỘNG'
                        : 'VÙNG VẪY'}{' '}
                      · Sâu {getDepthAt(activeAlertSwimmer.x, pool).toFixed(1)}m
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={acknowledgeAlert}
                    className="px-3 py-1 rounded-xl bg-white text-red-600 text-xs font-bold hover:bg-red-50 cursor-pointer whitespace-nowrap"
                  >
                    Xác nhận hỗ trợ
                  </button>
                </div>
              )}
            </div>

            {/* Bottom 3 Compact Telemetry Cards */}
            <div className="grid grid-cols-1 md:grid-cols-[1.25fr_0.85fr_1.2fr] gap-3 shrink-0">
              {/* Swimmer Summary */}
              <div className={`${glassPanelClass} p-3.5`}>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate text-sky-950 dark:text-white">
                      {selectedSwimmer?.name || 'Chưa chọn'}
                    </div>
                    <div className="font-mono text-[11px] text-sky-700/75 dark:text-sky-300/75">
                      {selectedSwimmer ? `${selectedSwimmer.id} · MPU6050` : '—'}
                    </div>
                  </div>
                  {selectedSwimmer && (
                    <span
                      className={`px-2.5 py-0.5 rounded-xl border text-[10.5px] font-bold uppercase whitespace-nowrap ${
                        selectedSwimmer.status === 'safe'
                          ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-700 dark:text-emerald-300'
                          : selectedSwimmer.status === 'warn'
                          ? 'bg-amber-500/15 border-amber-400/50 text-amber-700 dark:text-amber-300'
                          : 'bg-red-500/20 border-red-400/60 text-red-700 dark:text-red-300'
                      }`}
                    >
                      {selectedSwimmer.status === 'safe'
                        ? 'An toàn'
                        : selectedSwimmer.status === 'warn'
                        ? 'Chú ý'
                        : selectedSwimmer.mode === 'sos'
                        ? 'SOS'
                        : 'Nguy hiểm'}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className={`${innerCardClass} px-2.5 py-2`}>
                    <div className="text-[10px] text-slate-500 dark:text-sky-200/70">Gia tốc</div>
                    <div className="font-mono text-xs sm:text-sm font-bold mt-0.5 text-sky-700 dark:text-sky-300">
                      {selectedSwimmer ? `${selectedSwimmer.accelMag.toFixed(2)}g` : '—'}
                    </div>
                  </div>
                  <div className={`${innerCardClass} px-2.5 py-2`}>
                    <div className="text-[10px] text-slate-500 dark:text-sky-200/70">Góc</div>
                    <div className="font-mono text-xs sm:text-sm font-bold mt-0.5">
                      {selectedSwimmer ? `${selectedSwimmer.pitch.toFixed(1)}°` : '—'}
                    </div>
                  </div>
                  <div className={`${innerCardClass} px-2.5 py-2`}>
                    <div className="text-[10px] text-slate-500 dark:text-sky-200/70">Sâu / Pin</div>
                    <div className="font-mono text-xs sm:text-sm font-bold mt-0.5">
                      {selectedSwimmer
                        ? `${getDepthAt(selectedSwimmer.x, pool).toFixed(1)}m · ${selectedSwimmer.battery}%`
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Posture */}
              <div className={`${glassPanelClass} p-3.5 flex items-center gap-3`}>
                <div className="w-14 h-12 rounded-2xl bg-sky-500/15 border border-sky-300/50 dark:border-sky-300/25 flex items-center justify-center shrink-0">
                  <svg width="50" height="36" viewBox="0 0 56 44" className="text-sky-700 dark:text-white">
                    <line
                      x1="2"
                      y1="22"
                      x2="54"
                      y2="22"
                      stroke="#0ea5e9"
                      strokeWidth="1.2"
                      strokeDasharray="3,2"
                    />
                    <g
                      transform={`translate(28, 22) rotate(${
                        selectedSwimmer ? (-selectedSwimmer.pitch).toFixed(1) : 0
                      })`}
                    >
                      <line
                        x1="-14"
                        y1="0"
                        x2="10"
                        y2="0"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                      <circle cx="15" cy="0" r="4" fill="currentColor" />
                      <rect x="2" y="-3" width="4" height="6" fill="#0ea5e9" rx="1" />
                    </g>
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate text-sky-950 dark:text-white">
                    {postureInfo.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-sky-200/75 mt-0.5 truncate">
                    {postureInfo.desc}
                  </div>
                </div>
              </div>

              {/* Waveform */}
              <div className={`${glassPanelClass} p-3.5 flex flex-col justify-between`}>
                <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
                  <span className="text-sky-950 dark:text-sky-100 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-sky-500" />
                    <span>Gia tốc MPU6050</span>
                  </span>
                  <span className="font-mono text-sky-700 dark:text-sky-300">
                    Peak {chartPeak.toFixed(2)}g
                  </span>
                </div>
                <TelemetryChart
                  data={telemetryHistory}
                  status={selectedSwimmer?.status || 'safe'}
                  darkMode={darkMode}
                />
              </div>
            </div>
          </section>
        )}

        {/* ==================== PHẦN 2: ĐIỀU KHIỂN ==================== */}
        {layoutMode !== 'view' && (
          <aside className={`${glassPanelClass} flex flex-col min-h-0 overflow-hidden`}>
              <div className="px-4 py-2.5 border-b border-white/45 dark:border-sky-300/15 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-950 dark:text-white">
                <Settings2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Điều khiển</span>
              </div>
            </div>

            <div className="p-3 overflow-y-auto aqua-scroll flex-1 space-y-2.5">
              {/* ESP32 Connection */}
              <div className={`${innerCardClass} p-3`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-sky-950 dark:text-sky-100 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    <span>Kết nối ESP32</span>
                  </span>
                  <span
                    className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                      espError
                        ? 'bg-red-500/15 border-red-400/40 text-red-700 dark:text-red-300'
                        : espConnected
                        ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-700 dark:text-emerald-300'
                        : 'bg-white/40 dark:bg-sky-500/15 border-white/60 dark:border-sky-300/30 text-sky-900 dark:text-sky-200'
                    }`}
                  >
                    {espStatusLabel}
                  </span>
                </div>

                <select
                  value={connMode}
                  onChange={(e) => handleConnModeChange(e.target.value as ConnMode)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs font-medium bg-white/40 dark:bg-sky-950/45 border border-white/60 dark:border-sky-300/25 focus:border-sky-500 focus:outline-none"
                >
                  <option value="sim">Mô phỏng (Demo)</option>
                  <option value="esp32">ESP32 thật (Wi-Fi)</option>
                </select>

                {connMode === 'esp32' && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={espUrl}
                        onChange={(e) => setEspUrl(e.target.value)}
                        placeholder="ws://IP:81 hoặc http://IP/data"
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl text-xs font-mono bg-white/40 dark:bg-sky-950/45 border border-white/60 dark:border-sky-300/25 focus:border-sky-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={toggleEspConnection}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 cursor-pointer whitespace-nowrap"
                      >
                        {espConnected ? 'Ngắt' : 'Nối'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Safety Modes */}
              <div className={`${innerCardClass} p-3`}>
                <div className="text-xs font-bold text-sky-950 dark:text-sky-100 mb-2">
                  An toàn ({selectedSwimmer?.id || '—'})
                </div>
                <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                  <button
                    type="button"
                    onClick={() => triggerScenario('normal')}
                    className="py-1.5 px-2 rounded-xl text-xs font-semibold border border-emerald-400/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
                  >
                    An toàn
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerScenario('thrashing')}
                    className="py-1.5 px-2 rounded-xl text-xs font-semibold border border-amber-400/50 bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 cursor-pointer"
                  >
                    Vùng vẫy
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerScenario('immobile')}
                    className="py-1.5 px-2 rounded-xl text-xs font-semibold border border-red-400/50 bg-red-500/15 text-red-700 dark:text-red-300 hover:bg-red-500/25 cursor-pointer"
                  >
                    Bất động
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerScenario('sos')}
                    className="py-1.5 px-2 rounded-xl text-xs font-bold bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-400 hover:to-rose-500 shadow-[0_3px_10px_rgba(239,68,68,0.3)] cursor-pointer"
                  >
                    Nút SOS
                  </button>
                </div>
                <button
                  type="button"
                  onClick={resetAllSwimmers}
                  className="w-full py-1.5 px-3 rounded-xl text-xs font-semibold border border-white/60 dark:border-sky-300/20 bg-white/35 dark:bg-sky-900/35 hover:bg-white/55 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Đặt lại tất cả</span>
                </button>
              </div>

              {/* Swimmers */}
              <div className={`${innerCardClass} p-3`}>
                <div className="text-xs font-bold text-sky-950 dark:text-sky-100 mb-2">
                  Người bơi ({swimmers.length})
                </div>
                <form onSubmit={handleAddSwimmer} className="flex gap-1.5 mb-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={newSwimmerName}
                      onChange={(e) => setNewSwimmerName(e.target.value)}
                      placeholder="Tên học sinh..."
                      className="w-full pl-8 pr-2.5 py-1.5 rounded-xl text-xs bg-white/40 dark:bg-sky-950/45 border border-white/60 dark:border-sky-300/25 focus:border-sky-500 focus:outline-none placeholder:text-sky-900/50 dark:placeholder:text-sky-200/50"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-sky-500 to-blue-600 flex items-center gap-1 shadow-[0_3px_10px_rgba(14,165,233,0.3)] cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm</span>
                  </button>
                </form>

                <div className="space-y-1 max-h-32 overflow-y-auto aqua-scroll pr-0.5">
                  {swimmers.map((s) => {
                    const isSel = s.id === selectedSwimmer?.id;
                    const dotColor =
                      s.status === 'safe'
                        ? 'bg-emerald-500'
                        : s.status === 'warn'
                        ? 'bg-amber-500'
                        : 'bg-red-500';
                    return (
                      <div
                        key={s.id}
                        onClick={() => handleSelectSwimmer(s.id)}
                        className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-xs cursor-pointer transition-colors ${
                          isSel
                            ? 'border-sky-400 bg-sky-500/20 text-sky-950 dark:text-white'
                            : 'border-white/55 dark:border-sky-300/15 bg-white/30 dark:bg-sky-950/30 hover:bg-white/45'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                          <span className="font-mono font-bold shrink-0">{s.id}</span>
                          <span className="truncate">{s.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveSwimmer(s.id, e)}
                          disabled={swimmers.length <= 1}
                          title="Xóa"
                          className="p-0.5 rounded-lg text-sky-900/50 dark:text-sky-200/50 hover:text-red-500 disabled:opacity-30 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pool Size & Swim Pattern */}
              <div className={`${innerCardClass} p-3 space-y-2`}>
                <div className="text-xs font-bold text-sky-950 dark:text-sky-100">Hồ bơi</div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyPoolPreset(15, 8, 1.4)}
                    className={`py-1.5 px-1.5 rounded-xl text-[11px] font-semibold border cursor-pointer whitespace-nowrap ${
                      pool.length === 15 && pool.width === 8
                        ? 'border-sky-400 bg-sky-500/20 text-sky-900 dark:text-sky-100'
                        : 'border-white/55 dark:border-sky-300/20 bg-white/30 dark:bg-sky-950/30 hover:bg-white/45'
                    }`}
                  >
                    15×8m
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPoolPreset(25, 12.5, 1.8)}
                    className={`py-1.5 px-1.5 rounded-xl text-[11px] font-semibold border cursor-pointer whitespace-nowrap ${
                      pool.length === 25 && pool.width === 12.5
                        ? 'border-sky-400 bg-sky-500/20 text-sky-900 dark:text-sky-100'
                        : 'border-white/55 dark:border-sky-300/20 bg-white/30 dark:bg-sky-950/30 hover:bg-white/45'
                    }`}
                  >
                    25×12.5m
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPoolPreset(50, 25, 2.2)}
                    className={`py-1.5 px-1.5 rounded-xl text-[11px] font-semibold border cursor-pointer whitespace-nowrap ${
                      pool.length === 50 && pool.width === 25
                        ? 'border-sky-400 bg-sky-500/20 text-sky-900 dark:text-sky-100'
                        : 'border-white/55 dark:border-sky-300/20 bg-white/30 dark:bg-sky-950/30 hover:bg-white/45'
                    }`}
                  >
                    50×25m
                  </button>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span>Dài</span>
                    <span className="font-mono font-bold text-sky-800 dark:text-sky-300">
                      {pool.length.toFixed(1)}m
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={50}
                    step={0.5}
                    value={pool.length}
                    onChange={(e) => updatePoolDimension('length', parseFloat(e.target.value))}
                    className="w-full aqua-range"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span>Rộng</span>
                    <span className="font-mono font-bold text-sky-800 dark:text-sky-300">
                      {pool.width.toFixed(1)}m
                    </span>
                  </div>
                  <input
                    type="range"
                    min={6}
                    max={25}
                    step={0.5}
                    value={pool.width}
                    onChange={(e) => updatePoolDimension('width', parseFloat(e.target.value))}
                    className="w-full aqua-range"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span>Sâu tối đa</span>
                    <span className="font-mono font-bold text-sky-800 dark:text-sky-300">
                      {pool.maxDepth.toFixed(1)}m
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1.0}
                    max={2.5}
                    step={0.1}
                    value={pool.maxDepth}
                    onChange={(e) => updatePoolDimension('maxDepth', parseFloat(e.target.value))}
                    className="w-full aqua-range"
                  />
                </div>

                <select
                  value={swimPattern}
                  onChange={(e) => setSwimPattern(e.target.value as SwimPattern)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs font-medium bg-white/40 dark:bg-sky-950/45 border border-white/60 dark:border-sky-300/25 focus:border-sky-500 focus:outline-none"
                >
                  <option value="free">Bơi tự do quanh hồ</option>
                  <option value="lanes">Bơi theo làn (có phao)</option>
                </select>
              </div>

              {/* Event Log */}
              <div className={`${innerCardClass} p-3`}>
                <div className="text-xs font-bold text-sky-950 dark:text-sky-100 mb-1.5">
                  Nhật ký
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto aqua-scroll font-mono text-[11px]">
                  {logs.map((entry) => (
                    <div
                      key={entry.id}
                      className={`px-2.5 py-1 rounded-xl border ${
                        entry.level === 'danger'
                          ? 'bg-red-500/15 border-red-400/35 text-red-700 dark:text-red-300'
                          : entry.level === 'warn'
                          ? 'bg-amber-500/15 border-amber-400/35 text-amber-800 dark:text-amber-300'
                          : 'bg-white/30 dark:bg-sky-950/35 border-white/55 dark:border-sky-300/15 text-sky-900/80 dark:text-sky-100/80'
                      }`}
                    >
                      <span className="font-bold">[{entry.ts}]</span> {entry.message}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        )}
      </main>

      <DeployVercelModal
        open={deployModalOpen}
        user={user}
        onClose={() => setDeployModalOpen(false)}
        onLogout={handleLogout}
      />
    </div>
  );
}
