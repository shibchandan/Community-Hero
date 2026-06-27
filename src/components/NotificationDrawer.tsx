/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Issue, User } from '../types';
import {
  Bell, X, AlertOctagon, CheckCircle2, ThumbsUp,
  Flame, Shield, Clock, Sparkles, ChevronRight, Inbox
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: 'escalation' | 'resolved' | 'validated' | 'assigned' | 'reported' | 'comment';
  title: string;
  body: string;
  timestamp: string;
  issueId?: string;
  read: boolean;
}

interface NotificationDrawerProps {
  issues: Issue[];
  currentUser: User | null;
  theme: 'dark' | 'light';
  onSelectIssue?: (issueId: string) => void;
  expanded?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function deriveNotifications(issues: Issue[], currentUser: User | null): Notification[] {
  const notes: Notification[] = [];

  issues.forEach(issue => {
    // SLA Escalation alerts (always shown)
    if (issue.escalated && issue.escalationDate) {
      notes.push({
        id: `esc_${issue.id}`,
        type: 'escalation',
        title: '🚨 SLA Breach Escalated',
        body: `"${issue.title}" has breached its ${issue.slaDays}-day SLA and was auto-escalated.`,
        timestamp: issue.escalationDate,
        issueId: issue.id,
        read: false
      });
    }

    // Resolved issues reported by current user
    if (currentUser && issue.reportedBy === currentUser.id &&
      (issue.status === 'resolved' || issue.status === 'closed') && issue.resolvedAt) {
      notes.push({
        id: `res_${issue.id}`,
        type: 'resolved',
        title: '✅ Your Issue Was Resolved!',
        body: `"${issue.title}" has been successfully resolved by municipal crews.`,
        timestamp: issue.resolvedAt,
        issueId: issue.id,
        read: false
      });
    }

    // Community validated (high upvotes)
    if (issue.upvotes >= 3 && issue.status === 'community_verified') {
      notes.push({
        id: `val_${issue.id}`,
        type: 'validated',
        title: '👥 Community Verified',
        body: `"${issue.title}" received ${issue.upvotes} community upvotes and is now verified.`,
        timestamp: issue.createdAt,
        issueId: issue.id,
        read: false
      });
    }

    // Crew assigned
    if (issue.status === 'assigned' || issue.status === 'in_progress') {
      const tl = issue.timeline.find(t => t.status === 'assigned' || t.status === 'in_progress');
      if (tl) {
        notes.push({
          id: `asgn_${issue.id}`,
          type: 'assigned',
          title: '🔧 Crew Dispatched',
          body: `A maintenance crew has been assigned to "${issue.title}" in ${issue.location.area}.`,
          timestamp: tl.timestamp,
          issueId: issue.id,
          read: false
        });
      }
    }
  });

  // Sort by newest first, limit to 20
  return notes
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);
}

// ── Icon per notification type ────────────────────────────────────────────────

function NotifIcon({ type }: { type: Notification['type'] }) {
  const map = {
    escalation: { icon: AlertOctagon, cls: 'text-rose-400 bg-rose-500/15 border-rose-500/20' },
    resolved:   { icon: CheckCircle2, cls: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20' },
    validated:  { icon: ThumbsUp,     cls: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/20' },
    assigned:   { icon: Shield,       cls: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/20' },
    reported:   { icon: Sparkles,     cls: 'text-violet-400 bg-violet-500/15 border-violet-500/20' },
    comment:    { icon: Flame,        cls: 'text-amber-400 bg-amber-500/15 border-amber-500/20' },
  };
  const { icon: Icon, cls } = map[type] ?? map.reported;
  return (
    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${cls}`}>
      <Icon className="w-4 h-4" />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function NotificationBell({
  issues, currentUser, theme, onSelectIssue, expanded
}: NotificationDrawerProps) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const notifications = useMemo(
    () => deriveNotifications(issues, currentUser),
    [issues, currentUser]
  );

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  const markAllRead = () => setReadIds(new Set(notifications.map(n => n.id)));

  const handleOpen = () => {
    setOpen(true);
  };

  const handleNotifClick = (notif: Notification) => {
    setReadIds(prev => new Set([...prev, notif.id]));
    if (notif.issueId && onSelectIssue) {
      onSelectIssue(notif.issueId);
      setOpen(false);
    }
  };

  return (
    <>
      {/* Bell Button */}
      <button
        id="notification-bell-btn"
        onClick={handleOpen}
        aria-label={`Open notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        className={`w-full flex items-center gap-3 py-2 rounded-xl cursor-pointer transition-all duration-200 group ${
          expanded ? 'px-3' : 'px-0 justify-center'
        } ${
          theme === 'dark'
            ? 'text-slate-400 hover:text-white hover:bg-white/8'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
        }`}
      >
        <div className="relative flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 shrink-0 group-hover:animate-wiggle transition-transform" />
          {unreadCount > 0 && !expanded && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 border border-slate-950 flex items-center justify-center text-[8px] font-black text-white leading-none"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </div>
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className="text-xs font-bold whitespace-nowrap overflow-hidden"
            >
              Notifications
            </motion.span>
          )}
        </AnimatePresence>
        {unreadCount > 0 && expanded && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="ml-auto px-1.5 py-0.5 rounded-full bg-rose-500 text-[10px] font-black text-white leading-none min-w-[18px] text-center shrink-0"
          >
            {unreadCount}
          </motion.span>
        )}
      </button>

      {/* Drawer Overlay */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && (
            <>
              {/* Backdrop */}
              <motion.div
                key="notif-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                onClick={() => setOpen(false)}
              />

              {/* Panel */}
              <motion.div
                key="notif-panel"
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                className={`fixed top-0 right-0 h-full w-full max-w-sm z-50 flex flex-col shadow-2xl ${
                  theme === 'dark'
                    ? 'bg-slate-950 border-l border-white/10 text-white'
                    : 'bg-white border-l border-slate-200 text-slate-900'
                }`}
              >
                {/* Header */}
                <div className={`flex items-center justify-between px-5 py-4 border-b ${
                  theme === 'dark' ? 'border-white/10' : 'border-slate-100'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center">
                      <Bell className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <h2 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        Notifications
                      </h2>
                      <p className={`text-[10px] ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                        {unreadCount > 0 ? `${unreadCount} unread alerts` : 'All caught up!'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                          theme === 'dark'
                            ? 'text-indigo-400 hover:bg-indigo-50/10 border border-indigo-500/20'
                            : 'text-indigo-600 hover:bg-indigo-50 border border-indigo-200'
                        }`}
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      onClick={() => setOpen(false)}
                      aria-label="Close notifications"
                      className={`p-1.5 rounded-xl cursor-pointer transition-all ${
                        theme === 'dark'
                          ? 'text-gray-400 hover:bg-white/10 hover:text-white'
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Live Status Banner */}
                <div className={`mx-4 mt-3 px-3 py-2 rounded-xl flex items-center gap-2 text-[10px] font-bold border ${
                  theme === 'dark'
                    ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  Live — derived from {issues.length} active civic reports
                </div>

                {/* Notification List */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                        theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-100 border border-slate-200'
                      }`}>
                        <Inbox className={`w-8 h-8 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`} />
                      </div>
                      <div className="text-center">
                        <p className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                          No notifications yet
                        </p>
                        <p className={`text-[11px] mt-1 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>
                          Report issues or vote to start receiving alerts
                        </p>
                      </div>
                    </div>
                  ) : (
                    notifications.map(notif => {
                      const isRead = readIds.has(notif.id);
                      return (
                        <motion.div
                          key={notif.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`group flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                            isRead
                              ? theme === 'dark'
                                ? 'bg-transparent border-white/5 opacity-60 hover:opacity-80'
                                : 'bg-transparent border-slate-100 opacity-60 hover:opacity-80'
                              : theme === 'dark'
                                ? 'bg-white/5 border-white/10 hover:bg-white/8'
                                : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                          }`}
                          onClick={() => handleNotifClick(notif)}
                        >
                          <NotifIcon type={notif.type} />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-xs font-bold leading-tight ${
                                theme === 'dark' ? 'text-gray-100' : 'text-slate-800'
                              }`}>
                                {notif.title}
                              </p>
                              {!isRead && (
                                <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1" />
                              )}
                            </div>
                            <p className={`text-[11px] mt-1 leading-relaxed ${
                              theme === 'dark' ? 'text-gray-400' : 'text-slate-500'
                            }`}>
                              {notif.body}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <Clock className={`w-3 h-3 ${theme === 'dark' ? 'text-gray-600' : 'text-slate-400'}`} />
                              <span className={`text-[10px] font-mono ${
                                theme === 'dark' ? 'text-gray-600' : 'text-slate-400'
                              }`}>
                                {relativeTime(notif.timestamp)}
                              </span>
                              {notif.issueId && (
                                <span className={`ml-auto flex items-center gap-0.5 text-[10px] font-bold transition-all group-hover:gap-1 ${
                                  theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
                                }`}>
                                  View <ChevronRight className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className={`px-5 py-3 border-t text-center ${
                  theme === 'dark' ? 'border-white/10' : 'border-slate-100'
                }`}>
                  <p className={`text-[10px] font-mono ${theme === 'dark' ? 'text-gray-600' : 'text-slate-400'}`}>
                    Civic Intelligence Engine · Notification Stream v1.0
                  </p>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
