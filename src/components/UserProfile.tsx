/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Issue, User } from '../types';
import {
  UserCheck, Trophy, Star, Shield, Zap, MapPin, Clock, CheckCircle2,
  ThumbsUp, MessageSquare, BarChart3, Award, Flame, TrendingUp,
  FileText, AlertTriangle, ChevronRight, Calendar
} from 'lucide-react';

interface UserProfileProps {
  currentUser: User;
  issues: Issue[];
  theme: 'dark' | 'light';
  onViewIssue?: (issue: Issue) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getRankName(points: number) {
  if (points >= 400) return { name: 'District Guardian', emoji: '👑', color: 'from-yellow-400 to-amber-500' };
  if (points >= 250) return { name: 'Neighborhood Ambassador', emoji: '🏅', color: 'from-violet-500 to-purple-600' };
  if (points >= 100) return { name: 'Local Vigilante', emoji: '🕵️', color: 'from-blue-500 to-cyan-500' };
  return { name: 'Civic Rookie', emoji: '🌱', color: 'from-emerald-400 to-green-500' };
}

function getNextRankPoints(points: number) {
  if (points >= 400) return { needed: 0, next: 'Max Rank', total: 400 };
  if (points >= 250) return { needed: 400 - points, next: 'District Guardian', total: 150 };
  if (points >= 100) return { needed: 250 - points, next: 'Neighborhood Ambassador', total: 150 };
  return { needed: 100 - points, next: 'Local Vigilante', total: 100 };
}

function getBadgeEmoji(badge: string) {
  const map: Record<string, string> = {
    'Local Hero': '🏆', 'Pothole Patrol': '🚧', 'Street Light Sentry': '💡',
    'Waste Warden': '🚮', 'Civic Legend': '⭐', 'Supreme Validator': '🕵️', 'SLA Champion': '🎖️'
  };
  return map[badge] ?? '🏅';
}

function relativeDate(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  reported:          { label: 'Reported',          color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
  ai_verified:       { label: 'AI Verified',        color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  community_verified:{ label: 'Civic Verified',     color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  assigned:          { label: 'Crew Assigned',      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  in_progress:       { label: 'In Progress',        color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  resolved:          { label: 'Resolved ✅',        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  closed:            { label: 'Closed',             color: 'text-slate-500 bg-slate-500/5 border-slate-500/10' },
};

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color, theme }: {
  icon: any; label: string; value: string | number; color: string; theme: 'dark' | 'light';
}) {
  return (
    <div className={`p-4 rounded-2xl border flex flex-col gap-2 ${
      theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
    }`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
          {label}
        </p>
        <p className={`text-xl font-black font-mono mt-0.5 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function UserProfile({ currentUser, issues, theme, onViewIssue }: UserProfileProps) {
  const [reportTab, setReportTab] = useState<'all' | 'active' | 'resolved'>('all');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPassword.length < 6) {
      setErrorMsg('New password should be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsPending(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to update password.');
      } else {
        setSuccessMsg('✅ Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setErrorMsg('Network error. Failed to connect to server.');
    } finally {
      setIsPending(false);
    }
  };

  const rank = getRankName(currentUser.points);
  const rankProgress = getNextRankPoints(currentUser.points);
  const progressPercent = rankProgress.needed === 0
    ? 100
    : Math.round(((rankProgress.total - rankProgress.needed) / rankProgress.total) * 100);

  // My submitted reports
  const myReports = useMemo(() =>
    issues
      .filter(i => i.reportedBy === currentUser.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [issues, currentUser.id]
  );

  const filteredReports = useMemo(() => {
    if (reportTab === 'active') return myReports.filter(i => i.status !== 'resolved' && i.status !== 'closed');
    if (reportTab === 'resolved') return myReports.filter(i => i.status === 'resolved' || i.status === 'closed');
    return myReports;
  }, [myReports, reportTab]);

  // Activity stats derived from issues
  const totalVotesGiven = Object.keys(
    issues.reduce((acc, i) => ({ ...acc, ...i.votedUsers }), {} as Record<string, any>)
  ).filter(uid => uid === currentUser.id).length;
  const resolvedCount = myReports.filter(i => i.status === 'resolved' || i.status === 'closed').length;
  const escalatedCount = myReports.filter(i => i.escalated).length;

  // Avatar initials
  const initials = currentUser.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* ── Hero Profile Card ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className={`relative p-6 rounded-3xl border overflow-hidden ${
          theme === 'dark' ? 'bento-card' : 'bg-white border-slate-200 shadow-lg'
        }`}
      >
        {/* Top gradient bar */}
        <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${rank.color}`} />

        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${rank.color} flex items-center justify-center text-white text-2xl font-black shadow-lg`}>
              {initials}
            </div>
            <span className="absolute -bottom-2 -right-2 text-lg leading-none">{rank.emoji}</span>
          </div>

          {/* Name + rank */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className={`text-2xl font-black font-display ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {currentUser.name}
              </h2>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl border ${
                currentUser.role === 'authority'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
              }`}>
                {currentUser.role}
              </span>
            </div>
            <p className={`text-sm font-bold ${
              theme === 'dark' ? 'bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent' : 'text-indigo-600'
            }`}>
              {rank.name}
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className={`text-xs flex items-center gap-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                <MapPin className="w-3.5 h-3.5 text-indigo-400" /> {currentUser.area}
              </span>
              <span className={`text-xs flex items-center gap-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                <UserCheck className="w-3.5 h-3.5 text-cyan-400" /> {currentUser.email}
              </span>
            </div>
          </div>

          {/* Points + Trust */}
          <div className="flex gap-4 shrink-0">
            <div className="text-center">
              <div className={`text-3xl font-black font-mono ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {currentUser.points}
              </div>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                Points
              </div>
            </div>
            <div className={`w-px ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`} />
            <div className="text-center">
              <div className={`text-3xl font-black font-mono ${
                currentUser.trust_score >= 80 ? 'text-emerald-400' : currentUser.trust_score >= 50 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {currentUser.trust_score}%
              </div>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                Trust
              </div>
            </div>
          </div>
        </div>

        {/* Rank Progress Bar */}
        <div className="mt-6 space-y-1.5">
          <div className="flex justify-between text-[11px] font-bold">
            <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
              Progress to <span className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{rankProgress.next}</span>
            </span>
            <span className={theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}>
              {progressPercent}% complete
              {rankProgress.needed > 0 && <span className={theme === 'dark' ? ' text-slate-500' : ' text-slate-400'}> · {rankProgress.needed} pts to go</span>}
            </span>
          </div>
          <div className={`w-full h-2.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'}`}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className={`h-full rounded-full bg-gradient-to-r ${rank.color} shadow-sm`}
            />
          </div>
        </div>
      </motion.div>

      {/* ── Stats Grid ──────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
      >
        <StatCard icon={FileText} label="Reports Filed" value={myReports.length} color="text-indigo-400 bg-indigo-500/15" theme={theme} />
        <StatCard icon={CheckCircle2} label="Resolved" value={resolvedCount} color="text-emerald-400 bg-emerald-500/15" theme={theme} />
        <StatCard icon={ThumbsUp} label="Validations" value={currentUser.validations_count} color="text-cyan-400 bg-cyan-500/15" theme={theme} />
        <StatCard icon={AlertTriangle} label="SLA Escalated" value={escalatedCount} color="text-rose-400 bg-rose-500/15" theme={theme} />
      </motion.div>

      {/* ── Two column: Badges + My Reports ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Badges Panel */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bento-card' : 'bg-white border-slate-200 shadow-sm'}`}
        >
          <h3 className={`text-sm font-bold flex items-center gap-2 mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <Award className="w-4 h-4 text-amber-400" /> Earned Badges
            <span className={`ml-auto text-[10px] font-black px-2 py-0.5 rounded-lg ${
              theme === 'dark' ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>{currentUser.badges.length}</span>
          </h3>

          {currentUser.badges.length === 0 ? (
            <div className="text-center py-6">
              <span className="text-3xl">🌱</span>
              <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                Submit reports and vote to earn badges!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {currentUser.badges.map(badge => (
                <div
                  key={badge}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="text-xl">{getBadgeEmoji(badge)}</span>
                  <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                    {badge}
                  </span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto shrink-0" />
                </div>
              ))}
            </div>
          )}

          {/* Trust Score bar */}
          <div className={`mt-5 pt-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
            <div className="flex justify-between text-[11px] font-bold mb-1.5">
              <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>Trust Score</span>
              <span className={
                currentUser.trust_score >= 80 ? 'text-emerald-400' :
                currentUser.trust_score >= 50 ? 'text-amber-400' : 'text-rose-400'
              }>{currentUser.trust_score}%</span>
            </div>
            <div className={`w-full h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'}`}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${currentUser.trust_score}%` }}
                transition={{ duration: 1.2, delay: 0.3 }}
                className={`h-full rounded-full ${
                  currentUser.trust_score >= 80 ? 'bg-gradient-to-r from-emerald-400 to-cyan-400' :
                  currentUser.trust_score >= 50 ? 'bg-gradient-to-r from-amber-400 to-yellow-400' :
                  'bg-gradient-to-r from-rose-500 to-red-400'
                }`}
              />
            </div>
            <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>
              {currentUser.trust_score >= 80 ? '🌟 Highly trusted community validator'
               : currentUser.trust_score >= 50 ? '✅ Building civic credibility'
               : '⚡ Submit accurate reports to improve trust'}
            </p>
          </div>
        </motion.div>

        {/* My Reports Panel */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className={`lg:col-span-2 p-5 rounded-2xl border flex flex-col ${
            theme === 'dark' ? 'bento-card' : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-sm font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              <FileText className="w-4 h-4 text-indigo-400" /> My Submitted Reports
            </h3>
            {/* Mini tabs */}
            <div className={`flex gap-1 p-0.5 rounded-lg ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-100 border border-slate-200'}`}>
              {(['all', 'active', 'resolved'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setReportTab(t)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-md capitalize cursor-pointer transition-all ${
                    reportTab === t
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-80 pr-0.5">
            {filteredReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <FileText className={`w-10 h-10 ${theme === 'dark' ? 'text-slate-700' : 'text-slate-300'}`} />
                <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                  {reportTab === 'all' ? "You haven't filed any reports yet." : `No ${reportTab} reports found.`}
                </p>
              </div>
            ) : (
              filteredReports.map(issue => {
                const meta = STATUS_META[issue.status] ?? STATUS_META.reported;
                const ageDays = Math.max(1, Math.floor((Date.now() - new Date(issue.createdAt).getTime()) / 86400000));
                const slaPercent = Math.min(100, (ageDays / issue.slaDays) * 100);
                return (
                  <div
                    key={issue.id}
                    onClick={() => onViewIssue?.(issue)}
                    className={`group flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                      theme === 'dark'
                        ? 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-indigo-500/30'
                        : 'bg-slate-50 border-slate-200 hover:border-indigo-400/40 hover:bg-white shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${meta.color}`}>
                          {meta.label}
                        </span>
                        {issue.escalated && (
                          <span className="text-[9px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-md uppercase tracking-wider animate-pulse">
                            SLA Breach
                          </span>
                        )}
                      </div>
                      <p className={`text-xs font-bold leading-snug group-hover:text-indigo-400 transition-colors ${
                        theme === 'dark' ? 'text-slate-100' : 'text-slate-800'
                      }`}>
                        {issue.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className={`text-[10px] flex items-center gap-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                          <Calendar className="w-3 h-3" /> {relativeDate(issue.createdAt)}
                        </span>
                        <span className={`text-[10px] flex items-center gap-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                          <ThumbsUp className="w-3 h-3" /> {issue.upvotes} votes
                        </span>
                        <span className={`text-[10px] flex items-center gap-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                          <MessageSquare className="w-3 h-3" /> {issue.comments.length}
                        </span>
                      </div>
                      {/* SLA mini bar */}
                      {issue.status !== 'resolved' && issue.status !== 'closed' && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className={`flex-1 h-1 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-200'}`}>
                            <div
                              className={`h-full rounded-full transition-all ${
                                slaPercent > 85 ? 'bg-rose-500' : slaPercent > 60 ? 'bg-amber-500' : 'bg-indigo-500'
                              }`}
                              style={{ width: `${slaPercent}%` }}
                            />
                          </div>
                          <span className={`text-[9px] font-mono shrink-0 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>
                            SLA {ageDays}/{issue.slaDays}d
                          </span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5 ${
                      theme === 'dark' ? 'text-slate-600' : 'text-slate-300'
                    }`} />
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Account Security Section ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3 }}
        className={`p-6 rounded-2xl border ${
          theme === 'dark' ? 'bento-card' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <h3 className={`text-sm font-bold flex items-center gap-2 mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          <Shield className="w-4 h-4 text-emerald-400" /> Account Security & Password
        </h3>
        <p className={`text-xs mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
          Ensure your civic profile remains protected by updating your credentials regularly.
        </p>

        <form onSubmit={handlePasswordChange} className="max-w-md space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs font-bold rounded-xl border bg-rose-500/10 text-rose-400 border-rose-500/20">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-3 text-xs font-bold rounded-xl border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              {successMsg}
            </div>
          )}

          <div className="space-y-1">
            <label className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full text-xs font-mono px-3 py-2.5 rounded-xl border outline-none transition-all ${
                theme === 'dark'
                  ? 'bg-slate-950/60 border-white/10 text-white focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/35'
                  : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500 focus:bg-white'
              }`}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 chars"
                className={`w-full text-xs font-mono px-3 py-2.5 rounded-xl border outline-none transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-950/60 border-white/10 text-white focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/35'
                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500 focus:bg-white'
                }`}
                required
              />
            </div>

            <div className="space-y-1">
              <label className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className={`w-full text-xs font-mono px-3 py-2.5 rounded-xl border outline-none transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-950/60 border-white/10 text-white focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/35'
                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500 focus:bg-white'
                }`}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className={`cursor-pointer text-xs font-bold px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50`}
          >
            {isPending ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </motion.div>

    </div>
  );
}
