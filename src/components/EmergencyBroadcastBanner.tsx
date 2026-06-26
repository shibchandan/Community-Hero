/**
 * EmergencyBroadcastBanner Component
 * Polls /api/broadcasts/active every 30s and renders color-coded alert banners.
 */
import { useState, useEffect, useCallback, ComponentType } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Info, Zap, X, Radio } from 'lucide-react';
import type { Broadcast, BroadcastSeverity } from '../types';

interface Props {
  theme: 'dark' | 'light';
}

const SEVERITY_CONFIG: Record<BroadcastSeverity, {
  bg: string; border: string; text: string; icon: ComponentType<any>; label: string; pulse: string;
}> = {
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/40',
    text: 'text-blue-300',
    icon: Info,
    label: 'INFO',
    pulse: 'bg-blue-400',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    text: 'text-amber-300',
    icon: AlertTriangle,
    label: 'WARNING',
    pulse: 'bg-amber-400',
  },
  critical: {
    bg: 'bg-red-500/15',
    border: 'border-red-500/60',
    text: 'text-red-300',
    icon: Zap,
    label: 'CRITICAL ALERT',
    pulse: 'bg-red-400',
  },
};

export function EmergencyBroadcastBanner({ theme }: Props) {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const fetchBroadcasts = useCallback(async () => {
    try {
      const res = await fetch('/api/broadcasts/active');
      if (res.ok) {
        const data: Broadcast[] = await res.json();
        setBroadcasts(data);
      }
    } catch {
      // Silently fail — don't block UI on network errors
    }
  }, []);

  useEffect(() => {
    fetchBroadcasts();
    const interval = setInterval(fetchBroadcasts, 30_000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchBroadcasts]);

  const visible = broadcasts.filter(b => !dismissed.has(b.id));

  if (visible.length === 0) return null;

  return (
    <div className="relative z-30 mx-4 mt-2 space-y-2">
      <AnimatePresence>
        {visible.map((broadcast) => {
          const cfg = SEVERITY_CONFIG[broadcast.severity];
          const Icon = cfg.icon;
          return (
            <motion.div
              key={broadcast.id}
              initial={{ opacity: 0, y: -20, scaleY: 0.8 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -10, scaleY: 0.9 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className={`relative flex items-start gap-3 p-3 rounded-xl border backdrop-blur-md ${cfg.bg} ${cfg.border}`}
            >
              {/* Pulse dot */}
              <span className="flex h-2.5 w-2.5 mt-1 relative shrink-0">
                {broadcast.severity === 'critical' && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cfg.pulse}`} />
                )}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${cfg.pulse}`} />
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Radio className={`w-3.5 h-3.5 ${cfg.text}`} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.text}`}>
                    {cfg.label}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    Zone: {broadcast.targetZone}
                  </span>
                  <Icon className={`w-3.5 h-3.5 ${cfg.text} ml-auto`} />
                </div>
                <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  {broadcast.title}
                </p>
                <p className={`text-xs mt-0.5 leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                  {broadcast.message}
                </p>
                <p className="text-[9px] text-slate-500 mt-1 font-mono">
                  Issued by {broadcast.createdBy} •{' '}
                  Expires {new Date(broadcast.expiresAt).toLocaleTimeString()}
                </p>
              </div>

              <button
                onClick={() => setDismissed(prev => new Set([...prev, broadcast.id]))}
                className={`shrink-0 p-1 rounded-lg transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'text-slate-400 hover:text-white hover:bg-white/10'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-black/5'
                }`}
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
