export type SafetyStatus = 'safe' | 'warn' | 'danger';
export type SafetyMode = 'normal' | 'thrashing' | 'immobile' | 'sos';
export type LayoutMode = 'split' | 'view' | 'ctrl';
export type ConnMode = 'sim' | 'esp32';
export type SwimPattern = 'free' | 'lanes';

export interface PoolConfig {
  length: number;
  width: number;
  minDepth: number;
  maxDepth: number;
  lanes: number;
}

export interface Swimmer {
  id: string;
  name: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  turnPhase: number;
  mode: SafetyMode;
  status: SafetyStatus;
  accelMag: number;
  pitch: number;
  battery: number;
  anomalyTimer: number;
  phase: number;
}

export interface LogEntry {
  id: string;
  ts: string;
  message: string;
  level: 'info' | 'warn' | 'danger';
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'Cứu hộ viên' | 'Quản lý hồ bơi';
  createdAt: string;
}
