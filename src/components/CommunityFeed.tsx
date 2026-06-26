/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Issue, Comment, TimelineEvent, IssueCategory } from '../types';
import { 
  CheckCircle2, AlertTriangle, MessageSquare, MapPin, 
  ThumbsUp, ThumbsDown, Clock, ShieldAlert, ChevronDown, 
  ChevronUp, Send, User, Calendar 
} from 'lucide-react';

interface CommunityFeedProps {
  issues: Issue[];
  selectedIssueId?: string;
  onSelectIssue: (issue: Issue) => void;
  onVote: (issueId: string, voteType: 'valid' | 'invalid') => void;
  onAddComment: (issueId: string, commentText: string) => void;
  currentUserRole: 'citizen' | 'authority';
  theme?: 'dark' | 'light';
}

export default function CommunityFeed({ 
  issues, 
  selectedIssueId, 
  onSelectIssue, 
  onVote, 
  onAddComment,
  currentUserRole,
  theme = 'dark'
}: CommunityFeedProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'unresolved' | 'resolved' | 'escalated'>('unresolved');
  const [expandedCommentsId, setExpandedCommentsId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);

  // Filter logic
  const filteredIssues = issues.filter(issue => {
    switch (activeTab) {
      case 'unresolved':
        return issue.status !== 'resolved' && issue.status !== 'closed';
      case 'resolved':
        return issue.status === 'resolved' || issue.status === 'closed';
      case 'escalated':
        return issue.escalated;
      default:
        return true;
    }
  });

  const getCategoryBadge = (cat: IssueCategory) => {
    const map: Record<IssueCategory, { label: string, colorDark: string, colorLight: string }> = {
      road: { label: '🚧 Road Damage', colorDark: 'bg-amber-500/10 text-amber-400 border-amber-500/20', colorLight: 'bg-amber-500/20 text-amber-950 border-amber-500/40 font-bold' },
      garbage: { label: '🚮 Waste Overflow', colorDark: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', colorLight: 'bg-emerald-500/20 text-emerald-950 border-emerald-500/40 font-bold' },
      water: { label: '💧 Water Leak', colorDark: 'bg-sky-500/10 text-sky-400 border-sky-500/20', colorLight: 'bg-sky-500/20 text-sky-950 border-sky-500/40 font-bold' },
      streetlight: { label: '💡 Streetlight', colorDark: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', colorLight: 'bg-yellow-500/20 text-yellow-900 border-yellow-500/40 font-bold' },
      safety: { label: '🚨 Public Safety', colorDark: 'bg-rose-500/10 text-rose-400 border-rose-500/20', colorLight: 'bg-rose-500/20 text-rose-950 border-rose-500/40 font-bold' }
    };
    const details = map[cat] || { label: cat, colorDark: 'bg-slate-500/10 text-slate-400 border-slate-500/20', colorLight: 'bg-slate-200/80 text-slate-900 border-slate-300 font-bold' };
    return (
      <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${theme === 'dark' ? details.colorDark : details.colorLight}`}>
        {details.label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string, colorDark: string, colorLight: string }> = {
      reported: { label: 'Backlog Reported', colorDark: 'bg-slate-500/10 text-slate-400 border-slate-500/20', colorLight: 'bg-slate-200/80 text-slate-800 border-slate-300 font-bold' },
      ai_verified: { label: 'AI Scanning OK', colorDark: 'bg-violet-500/10 text-violet-400 border-violet-500/20', colorLight: 'bg-violet-200/80 text-violet-950 border-violet-300 font-bold' },
      community_verified: { label: 'Civic Verified', colorDark: 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse', colorLight: 'bg-blue-200/80 text-blue-950 border-blue-300 font-bold animate-pulse' },
      assigned: { label: 'Assigned Crew', colorDark: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', colorLight: 'bg-indigo-200/80 text-indigo-950 border-indigo-300 font-bold' },
      in_progress: { label: 'In Progress', colorDark: 'bg-purple-500/10 text-purple-400 border-purple-500/20', colorLight: 'bg-purple-200/80 text-purple-950 border-purple-300 font-bold' },
      resolved: { label: 'Repaired Fixed', colorDark: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', colorLight: 'bg-emerald-200/80 text-emerald-950 border-emerald-300 font-bold' },
      closed: { label: 'Archived Closed', colorDark: 'bg-slate-400/10 text-slate-400 border-slate-400/20', colorLight: 'bg-slate-200 text-slate-700 border-slate-300 font-bold' }
    };
    const details = map[status] || { label: status, colorDark: 'bg-slate-500/10 text-slate-400 border-slate-500/20', colorLight: 'bg-slate-200 text-slate-800 border-slate-300 font-bold' };
    return (
      <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${theme === 'dark' ? details.colorDark : details.colorLight}`}>
        {details.label}
      </span>
    );
  };

  const handleCommentSubmit = (issueId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) {
      setCommentError('Comment text cannot be empty.');
      return;
    }
    onAddComment(issueId, commentText);
    setCommentText('');
    setCommentError(null);
  };

  const getDaysAgo = (dateStr: string) => {
    const created = new Date(dateStr);
    const diff = Date.now() - created.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  return (
    <div className="flex flex-col gap-4">
      
      {/* Feed Filters Tabs */}
      <div className={`flex p-1 rounded-xl backdrop-blur-md ${
        theme === 'dark' 
          ? 'bg-white/5 border border-white/10' 
          : 'bg-white/45 border border-white/80 shadow-xs'
      }`}>
        {(['unresolved', 'resolved', 'escalated', 'all'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all capitalize cursor-pointer ${
              activeTab === tab
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 border border-indigo-500/50'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-white/5'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white/50'
            }`}
          >
            {tab === 'unresolved' ? 'Active Issues' : tab === 'resolved' ? 'Resolved Works' : tab === 'escalated' ? '🚨 SLA Breaches' : 'Backlog All'}
          </button>
        ))}
      </div>

      {/* Feed List */}
      <div className="space-y-4 max-h-[850px] overflow-y-auto pr-1">
        {filteredIssues.length === 0 ? (
          <div className={`p-12 text-center rounded-2xl border border-dashed ${
            theme === 'dark' 
              ? 'bg-white/5 border-white/10 text-gray-400' 
              : 'bg-white/40 border-white/70 text-slate-600'
          }`}>
            <Clock className="w-10 h-10 mx-auto mb-3 text-slate-400 dark:text-gray-400" />
            <h4 className={`text-sm font-bold font-display ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>No Civic Complaints Matched</h4>
            <p className="text-xs mt-1">This stream is currently clear. Use the reporter form to submit issues.</p>
          </div>
        ) : (
          filteredIssues.map(issue => {
            const isSelected = selectedIssueId === issue.id;
            const upvotes = issue.upvotes || 0;
            const downvotes = issue.downvotes || 0;
            const totalVotes = upvotes + downvotes;
            const confidenceScore = upvotes - downvotes;
            
            // SLA math
            const issueAgeDays = Math.max(1, Math.floor((Date.now() - new Date(issue.createdAt).getTime()) / (1000 * 60 * 60 * 24)));
            const slaProgressPercent = Math.min(100, (issueAgeDays / issue.slaDays) * 100);

            return (
              <div
                key={issue.id}
                onClick={() => onSelectIssue(issue)}
                className={`group p-5 rounded-2xl transition-all duration-300 border cursor-pointer hover:shadow-2xl ${
                  isSelected 
                    ? theme === 'dark'
                      ? 'bg-white/10 border-indigo-500 ring-2 ring-indigo-500/50 glow-indigo' 
                      : 'bg-white/80 border-indigo-500 ring-2 ring-indigo-500/30 shadow-md'
                    : theme === 'dark'
                      ? 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                      : 'bg-white/40 border-white/60 hover:border-white/90 hover:bg-white/65'
                }`}
              >
                {/* SLA Breach Warning Bar */}
                {issue.escalated && issue.status !== 'closed' && (
                  <div className="mb-4 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/25 flex items-center justify-between text-[10px] text-red-600 dark:text-red-400 animate-pulse">
                    <span className="font-extrabold flex items-center gap-1">
                      <ShieldAlert className="w-4 h-4 text-red-500" />
                      AUTONOMOUS ESCALATION ACTIVE — OVERDUE BY {issueAgeDays - issue.slaDays} DAYS
                    </span>
                    <span className="font-mono bg-red-500/20 px-1.5 py-0.5 rounded text-[8px] uppercase font-bold">Priority SLA Breached</span>
                  </div>
                )}

                {/* Header Info */}
                <div className="flex justify-between items-start gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {getCategoryBadge(issue.category)}
                      {getStatusBadge(issue.status)}
                      <span className={`text-[10px] flex items-center gap-1 font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700 font-bold'}`}>
                        <Calendar className="w-3 h-3" />
                        {getDaysAgo(issue.createdAt)}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-display group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                      {issue.title}
                    </h3>
                  </div>

                  {/* Severity Badge */}
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-white ${
                    issue.severity === 'high' 
                      ? 'bg-red-500 shadow-md shadow-red-500/20' 
                      : issue.severity === 'medium' 
                        ? 'bg-amber-500 shadow-md shadow-amber-500/20' 
                        : 'bg-emerald-500'
                  }`}>
                    {issue.severity} Severity
                  </span>
                </div>

                {/* Main description */}
                <p className={`text-xs mt-3 line-clamp-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-800 font-medium'}`}>
                  {issue.description}
                </p>

                {/* Geo Location / Department Label */}
                <div className={`flex flex-wrap gap-4 mt-4 text-[11px] border-t pt-3 ${
                  theme === 'dark' 
                    ? 'text-slate-400 border-slate-800/60' 
                    : 'text-slate-700 border-slate-200/60 font-medium'
                }`}>
                  <div className={`flex items-center gap-1 font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-900'}`}>
                    <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{issue.location.address}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>Routed Agency: {issue.department}</span>
                  </div>
                </div>

                {/* SLA Meter */}
                {issue.status !== 'resolved' && issue.status !== 'closed' && (
                  <div className="mt-3">
                    <div className={`flex justify-between text-[9px] mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700 font-bold'}`}>
                      <span className="font-bold uppercase tracking-wider">SLA Performance Target</span>
                      <span>{issueAgeDays} / {issue.slaDays} Days Used</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          slaProgressPercent > 85 
                            ? 'bg-red-500' 
                            : slaProgressPercent > 60 
                              ? 'bg-amber-500' 
                              : 'bg-indigo-500'
                        }`}
                        style={{ width: `${slaProgressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Proof of Resolution (if available) */}
                {issue.resolvedAt && (
                  <div className={`mt-4 p-3 rounded-xl flex flex-col md:flex-row gap-3 items-start md:items-center ${
                    theme === 'dark' 
                      ? 'bg-emerald-500/5 border border-emerald-500/10' 
                      : 'bg-emerald-50 border border-emerald-200'
                  }`}>
                    <img src={issue.resolutionProofUrl || ''} alt="Proof" referrerPolicy="no-referrer" className={`w-20 aspect-square rounded-lg object-cover border ${
                      theme === 'dark' ? 'border-emerald-500/20' : 'border-emerald-300'
                    }`} />
                    <div className="flex-1 space-y-1">
                      <h4 className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Resolution Confirmed & Sealed
                      </h4>
                      <p className={`text-xs italic ${theme === 'dark' ? 'text-slate-300' : 'text-slate-800 font-medium'}`}>
                        "{issue.resolutionNotes}"
                      </p>
                      <span className={`text-[9px] block font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600 font-bold'}`}>
                        Closed Date: {new Date(issue.resolvedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Expand Accordion Section for interactive details */}
                {isSelected && (
                  <div className={`mt-5 space-y-5 border-t pt-4 animate-fadeIn ${
                    theme === 'dark' ? 'border-slate-800/60' : 'border-slate-200/80'
                  }`} onClick={(e) => e.stopPropagation()}>
                    
                    {/* Urgency Reason */}
                    {issue.urgencyReason && (
                      <div className={`p-3 rounded-xl border text-xs ${
                        theme === 'dark' 
                          ? 'bg-violet-500/5 border-violet-500/10 text-slate-300' 
                          : 'bg-violet-50/85 border-violet-200 text-slate-850 font-medium'
                      }`}>
                        <span className="font-extrabold text-violet-600 dark:text-violet-400 block uppercase tracking-wider text-[9px] mb-1">AI Safety Analysis Risk Profile</span>
                        "{issue.urgencyReason}"
                      </div>
                    )}

                    {/* Timeline Tracker */}
                    <div>
                      <h4 className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${
                        theme === 'dark' ? 'text-slate-500' : 'text-slate-700 font-extrabold'
                      }`}>Incident SLA Resolution History</h4>
                      <div className={`space-y-4 border-l-2 ml-2.5 pl-4 ${
                        theme === 'dark' ? 'border-slate-800' : 'border-slate-300'
                      }`}>
                        {issue.timeline?.map((ev) => (
                          <div key={ev.id} className="relative">
                            {/* Bullet dot */}
                            <span className={`absolute -left-[23px] top-1.5 flex h-2.5 w-2.5 items-center justify-center rounded-full ${
                              ev.status === 'resolved' || ev.status === 'closed'
                                ? 'bg-emerald-500 ring-4 ring-emerald-500/20'
                                : ev.status === 'assigned' || ev.status === 'in_progress'
                                  ? 'bg-indigo-500 ring-4 ring-indigo-500/20'
                                  : 'bg-slate-400 ring-4 ring-slate-400/10'
                            }`} />
                            <div className="text-[11px]">
                              <span className={`font-bold block ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900 font-extrabold'}`}>{ev.title}</span>
                              <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700 font-medium'}`}>{ev.description}</p>
                              <div className={`flex gap-2 items-center text-[9px] mt-1 font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-slate-650 font-bold'}`}>
                                <span>{new Date(ev.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                <span>•</span>
                                <span>Agent: {ev.by}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Voting Module */}
                    {issue.status !== 'resolved' && issue.status !== 'closed' && (
                      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border ${
                        theme === 'dark' 
                          ? 'bg-slate-500/5 border-slate-800/40' 
                          : 'bg-slate-100/90 border-slate-300/80 shadow-xs'
                      }`}>
                        <div>
                          <h4 className={`text-xs font-bold flex items-center gap-1.5 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900 font-extrabold'}`}>
                            <Clock className="w-4 h-4 text-indigo-500" />
                            Community Verification Threshold
                          </h4>
                          <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-750 font-semibold'}`}>
                            Current Support: <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{confidenceScore} Support votes</span> (Requires +2 Support to assign SLA Crew)
                          </p>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => onVote(issue.id, 'valid')}
                            className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" /> Mark Valid (+10 Points)
                          </button>
                          <button
                            onClick={() => onVote(issue.id, 'invalid')}
                            className="text-[10px] font-bold px-3 py-1.5 rounded-lg text-rose-500 border border-rose-500/20 hover:bg-rose-500/10 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" /> Flag Fake/Invalid
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Interactive Discussions */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h4 className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                          theme === 'dark' ? 'text-slate-500' : 'text-slate-750 font-extrabold'
                        }`}>
                          <MessageSquare className="w-3.5 h-3.5" /> Constructive Discussion ({issue.comments?.length || 0})
                        </h4>
                      </div>

                      {/* Comment Input */}
                      <form onSubmit={(e) => handleCommentSubmit(issue.id, e)} className="flex gap-2 mb-3">
                        <input
                          type="text"
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Provide supportive details, safety advice, or coordinates clarification..."
                          className={`flex-1 text-xs px-3 py-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                            theme === 'dark' 
                              ? 'border-slate-800 bg-slate-950/45 text-slate-100 placeholder-slate-600' 
                              : 'border-slate-300 bg-white/85 text-slate-900 placeholder-slate-500 font-medium shadow-xs'
                          }`}
                        />
                        <button
                          type="submit"
                          className="px-3.5 py-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-all cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </form>

                      {/* Comment list */}
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {issue.comments?.length === 0 ? (
                          <span className={`text-[10px] block italic text-center py-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600 font-semibold'}`}>No comments logged. Keep discussion constructive.</span>
                        ) : (
                          issue.comments?.map((c) => (
                            <div key={c.id} className={`p-2.5 rounded-lg border text-xs ${
                              theme === 'dark' 
                                ? 'bg-slate-900/30 border-slate-800/30' 
                                : 'bg-white/80 border-slate-200/60 shadow-xs'
                            }`}>
                              <div className="flex justify-between items-center mb-1 text-[9px]">
                                <span className={`font-bold flex items-center gap-1 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900 font-extrabold'}`}>
                                  <User className="w-3 h-3 text-indigo-400" />
                                  {c.userName} ({c.userRole})
                                </span>
                                <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600 font-bold'}>{getDaysAgo(c.createdAt)}</span>
                              </div>
                              <p className={`text-xs ${theme === 'dark' ? 'text-slate-300' : 'text-slate-800 font-medium'}`}>{c.text}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
