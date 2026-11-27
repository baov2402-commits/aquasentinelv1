import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, User, Waves } from 'lucide-react';
import type { AuthUser } from '../types/aquasentinel';

interface LoginScreenProps {
  onLoginSuccess: (user: AuthUser, remember: boolean) => void;
  darkMode: boolean;
  onToggleTheme: () => void;
}

interface StoredAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'Cứu hộ viên' | 'Quản lý hồ bơi';
  createdAt: string;
}

const ACCOUNTS_KEY = 'aquasentinel_accounts_v1';

function hashPassword(raw: string): string {
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `h_${(h >>> 0).toString(16)}`;
}

function getStoredAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredAccounts(accounts: StoredAccount[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  darkMode,
  onToggleTheme,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Cứu hộ viên' | 'Quản lý hồ bơi'>('Cứu hộ viên');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Vui lòng nhập email hợp lệ.');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu cần ít nhất 6 ký tự.');
      return;
    }

    const accounts = getStoredAccounts();

    if (tab === 'register') {
      const cleanName = name.trim();
      if (cleanName.length < 2) {
        setError('Vui lòng nhập họ tên.');
        return;
      }
      if (accounts.some((acc) => acc.email === cleanEmail)) {
        setError('Email đã tồn tại. Hãy chuyển sang Đăng nhập.');
        return;
      }
      const newAcc: StoredAccount = {
        id: `OP-${Date.now().toString().slice(-4)}`,
        name: cleanName,
        email: cleanEmail,
        passwordHash: hashPassword(password),
        role,
        createdAt: new Date().toISOString(),
      };
      saveStoredAccounts([...accounts, newAcc]);
      onLoginSuccess(
        {
          id: newAcc.id,
          name: newAcc.name,
          email: newAcc.email,
          role: newAcc.role,
          createdAt: newAcc.createdAt,
        },
        remember
      );
      return;
    }

    const found = accounts.find((acc) => acc.email === cleanEmail);
    if (!found) {
      setError('Chưa có tài khoản này. Hãy đăng ký hoặc vào Demo.');
      return;
    }
    if (found.passwordHash !== hashPassword(password)) {
      setError('Mật khẩu không đúng.');
      return;
    }
    onLoginSuccess(
      {
        id: found.id,
        name: found.name,
        email: found.email,
        role: found.role,
        createdAt: found.createdAt,
      },
      remember
    );
  };

  const handleQuickDemoLogin = () => {
    onLoginSuccess(
      {
        id: 'OP-DEMO',
        name: 'Giám sát Demo',
        email: 'demo@aquasentinel.vn',
        role: 'Cứu hộ viên',
        createdAt: new Date().toISOString(),
      },
      remember
    );
  };

  return (
    <div
      className={`relative min-h-screen w-full flex flex-col justify-between p-4 sm:p-6 overflow-hidden transition-colors duration-200 ${
        darkMode
          ? 'bg-gradient-to-br from-sky-950 via-blue-950 to-slate-950 text-slate-100'
          : 'bg-gradient-to-br from-sky-400/80 via-sky-200 to-white text-sky-950'
      }`}
    >
      {/* Ambient aquatic light spheres visible through transparent glass */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-sky-400/45 dark:bg-sky-500/25 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-24 w-96 h-96 rounded-full bg-cyan-300/45 dark:bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 w-96 h-96 rounded-full bg-blue-400/35 dark:bg-cyan-400/15 blur-3xl" />

      <header className="relative z-10 w-full max-w-4xl mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center font-mono font-bold text-sm text-white shadow-[0_6px_18px_rgba(14,165,233,0.35)]">
            AS
          </div>
          <span className="text-lg font-bold tracking-tight whitespace-nowrap text-sky-950 dark:text-white">
            AquaSentinel
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          className="px-3.5 py-2 rounded-2xl text-xs font-semibold border border-white/65 dark:border-sky-300/25 bg-white/30 dark:bg-sky-950/35 backdrop-blur-xl hover:bg-white/45 dark:hover:bg-sky-900/45 transition-colors cursor-pointer whitespace-nowrap"
        >
          {darkMode ? 'Nền Xanh Trắng' : 'Nền Tối'}
        </button>
      </header>

      <main className="relative z-10 w-full max-w-4xl mx-auto my-auto py-4 grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
        {/* Left concise card */}
        <section className="md:col-span-5 rounded-3xl p-6 sm:p-7 border border-white/65 dark:border-sky-300/25 bg-white/28 dark:bg-sky-950/30 backdrop-blur-2xl shadow-[0_16px_42px_rgba(2,132,199,0.16),inset_0_1px_0_rgba(255,255,255,0.7)] flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-sky-800 dark:text-sky-300 mb-3">
              <Waves className="w-4 h-4" />
              <span>Giám sát an toàn hồ bơi</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug text-balance text-sky-950 dark:text-white mb-3">
              Theo dõi mặt nước theo thời gian thực
            </h1>
            <p className="text-sm text-sky-900/80 dark:text-sky-100/80 leading-relaxed">
              Hiển thị vị trí người bơi, phân tích gia tốc ESP32 + MPU6050 và cảnh báo SOS tức thì.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-5 mt-5 border-t border-white/45 dark:border-sky-300/20">
            <div className="p-3 rounded-2xl bg-white/30 dark:bg-sky-900/25 border border-white/60 dark:border-sky-300/20 backdrop-blur-md">
              <div className="text-[11px] text-sky-900/70 dark:text-sky-200/70">Phần cứng</div>
              <div className="font-mono text-xs font-bold text-sky-900 dark:text-sky-300 mt-0.5">
                ESP32 · MPU6050
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-white/30 dark:bg-sky-900/25 border border-white/60 dark:border-sky-300/20 backdrop-blur-md">
              <div className="text-[11px] text-sky-900/70 dark:text-sky-200/70">Triển khai</div>
              <div className="font-mono text-xs font-bold text-sky-900 dark:text-sky-300 mt-0.5">
                GitHub · Vercel
              </div>
            </div>
          </div>
        </section>

        {/* Right concise login form */}
        <section className="md:col-span-7 rounded-3xl p-6 sm:p-7 border border-white/65 dark:border-sky-300/25 bg-white/32 dark:bg-sky-950/35 backdrop-blur-2xl shadow-[0_16px_42px_rgba(2,132,199,0.18),inset_0_1px_0_rgba(255,255,255,0.7)] flex flex-col justify-center">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-white/30 dark:bg-sky-950/45 border border-white/60 dark:border-sky-300/20 mb-5">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setError('');
              }}
              className={`py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                tab === 'login'
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.35)]'
                  : 'text-sky-950/75 dark:text-sky-100/75 hover:text-sky-950 dark:hover:text-white'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setError('');
              }}
              className={`py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                tab === 'register'
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.35)]'
                  : 'text-sky-950/75 dark:text-sky-100/75 hover:text-sky-950 dark:hover:text-white'
              }`}
            >
              Đăng ký
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {tab === 'register' && (
              <div className="relative">
                <User className="w-4 h-4 text-sky-600 dark:text-sky-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Họ tên"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl text-sm bg-white/45 dark:bg-sky-950/45 border border-white/65 dark:border-sky-300/25 focus:border-sky-500 focus:outline-none placeholder:text-sky-900/50 dark:placeholder:text-sky-200/50"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="w-4 h-4 text-sky-600 dark:text-sky-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl text-sm bg-white/45 dark:bg-sky-950/45 border border-white/65 dark:border-sky-300/25 focus:border-sky-500 focus:outline-none placeholder:text-sky-900/50 dark:placeholder:text-sky-200/50"
              />
            </div>

            <div className="relative">
              <Lock className="w-4 h-4 text-sky-600 dark:text-sky-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                className="w-full pl-10 pr-10 py-2.5 rounded-2xl text-sm bg-white/45 dark:bg-sky-950/45 border border-white/65 dark:border-sky-300/25 focus:border-sky-500 focus:outline-none placeholder:text-sky-900/50 dark:placeholder:text-sky-200/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sky-700/70 dark:text-sky-300 hover:text-sky-900 cursor-pointer"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {tab === 'register' && (
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'Cứu hộ viên' | 'Quản lý hồ bơi')}
                className="w-full px-3.5 py-2.5 rounded-2xl text-sm bg-white/45 dark:bg-sky-950/45 border border-white/65 dark:border-sky-300/25 focus:border-sky-500 focus:outline-none"
              >
                <option value="Cứu hộ viên">Vai trò: Cứu hộ viên</option>
                <option value="Quản lý hồ bơi">Vai trò: Quản lý hồ bơi</option>
              </select>
            )}

            <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none text-sky-900/80 dark:text-sky-100/80">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded accent-sky-500"
              />
              <span>Ghi nhớ đăng nhập</span>
            </label>

            {error && (
              <div className="px-3.5 py-2 rounded-2xl text-xs font-medium bg-red-500/20 border border-red-400/50 text-red-700 dark:text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-[0_8px_22px_rgba(14,165,233,0.35)] transition-all cursor-pointer"
            >
              {tab === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-white/45 dark:border-sky-300/20">
            <button
              type="button"
              onClick={handleQuickDemoLogin}
              className="w-full py-2.5 px-4 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 border border-white/65 dark:border-sky-300/25 bg-white/35 dark:bg-sky-500/15 text-sky-900 dark:text-sky-100 hover:bg-white/55 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-300" />
              <span>Vào nhanh Demo</span>
            </button>
          </div>
        </section>
      </main>

      <footer className="relative z-10 w-full max-w-4xl mx-auto text-center text-xs text-sky-900/65 dark:text-sky-200/60 py-1">
        AquaSentinel · GitHub &amp; Vercel Ready
      </footer>
    </div>
  );
};
