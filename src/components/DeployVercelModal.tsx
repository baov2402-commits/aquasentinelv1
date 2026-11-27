import React, { useState } from 'react';
import { Check, Copy, ExternalLink, GitBranch, LogOut, Shield, X } from 'lucide-react';
import type { AuthUser } from '../types/aquasentinel';

interface DeployVercelModalProps {
  open: boolean;
  user: AuthUser;
  onClose: () => void;
  onLogout: () => void;
}

const GIT_COMMANDS = `git init
git add .
git commit -m "AquaSentinel Pool Monitor"
git branch -M main
git remote add origin https://github.com/<tai-khoan>/aquasentinel.git
git push -u origin main`;

export const DeployVercelModal: React.FC<DeployVercelModalProps> = ({
  open,
  user,
  onClose,
  onLogout,
}) => {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(GIT_COMMANDS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sky-900/25 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-white/65 dark:border-sky-300/25 bg-white/45 dark:bg-sky-950/55 backdrop-blur-2xl text-sky-950 dark:text-slate-100 shadow-[0_24px_60px_rgba(2,132,199,0.22),inset_0_1px_0_rgba(255,255,255,0.7)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/50 dark:border-sky-300/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h2 className="text-sm font-bold">Tài khoản &amp; Vercel</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-sky-900/70 dark:text-sky-200 hover:bg-white/40 dark:hover:bg-sky-900/50 cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto aqua-scroll">
          {/* Profile */}
          <div className="p-3.5 rounded-2xl border border-white/60 dark:border-sky-300/20 bg-white/30 dark:bg-sky-900/25 backdrop-blur-md flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-bold truncate">{user.name}</div>
              <div className="text-xs text-slate-500 dark:text-sky-200/70 truncate">
                {user.email} · {user.role}
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-red-400/40 bg-red-500/10 text-red-600 dark:text-red-300 hover:bg-red-500/20 cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>

          {/* GitHub + Vercel */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-300">
                <GitBranch className="w-4 h-4" />
                <span>Đưa lên GitHub &amp; Vercel</span>
              </div>
              <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                Đã có vercel.json
              </span>
            </div>

            <div className="relative rounded-2xl border border-sky-200/80 dark:border-sky-300/20 bg-slate-900 text-slate-100 p-3 font-mono text-[11px] leading-relaxed overflow-x-auto">
              <button
                type="button"
                onClick={handleCopy}
                className="absolute top-2.5 right-2.5 px-2 py-1 rounded-lg text-[11px] font-sans font-semibold bg-slate-800 hover:bg-slate-700 flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Đã chép' : 'Chép'}</span>
              </button>
              <pre className="pr-16 whitespace-pre-wrap">{GIT_COMMANDS}</pre>
            </div>

            <div className="flex gap-2">
              <a
                href="https://github.com/new"
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2 px-3 rounded-2xl text-xs font-semibold border border-sky-200 dark:border-sky-300/25 bg-white/75 dark:bg-sky-900/40 hover:border-sky-400 flex items-center justify-center gap-1.5"
              >
                <span>GitHub mới</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://vercel.com/new"
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2 px-3 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 flex items-center justify-center gap-1.5 shadow-[0_4px_14px_rgba(14,165,233,0.35)]"
              >
                <span>Vercel Deploy</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
