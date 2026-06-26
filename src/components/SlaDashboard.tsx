/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Issue, IssueCategory, User } from '../types';
import { BarChart3, TrendingUp, AlertOctagon, Sparkles, Building2, ShieldAlert, CheckCircle, Clock, Trophy, Award, Zap, Download, Loader2 } from 'lucide-react';
import { generatePrintReport } from '../lib/generatePrintReport';

interface SlaDashboardProps {
  issues: Issue[];
  usersList?: User[];
  theme?: 'dark' | 'light';
}

interface PredictiveRisk {
  id: string;
  zone: string;
  hazardType: string;
  probability: number;
  factors: string[];
  recommendedAction: string;
}

export default function SlaDashboard({ issues, usersList = [], theme = 'dark' }: SlaDashboardProps) {
  const [predictiveRisks, setPredictiveRisks] = useState<PredictiveRisk[]>([]);
  const [loadingRisks, setLoadingRisks] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    // Small delay to allow React to update the button state before blocking the thread
    await new Promise(r => setTimeout(r, 100));
    generatePrintReport({ issues, usersList, predictiveRisks });
    setIsExporting(false);
  };

  // Points & Gamification analytics math
  const totalPoints = usersList.reduce((sum, u) => sum + (u.points || 0), 0);
  const avgPoints = usersList.length > 0 ? Math.round(totalPoints / usersList.length) : 0;

  // Points earned by category distribution
  const totalIssuesByCategory = issues.length || 1;
  const categoryPointsData = [
    { category: 'road', name: 'Road Damage Patrolling', points: issues.filter(i => i.category === 'road').length * 20, percent: Math.max(5, Math.round((issues.filter(i => i.category === 'road').length / totalIssuesByCategory) * 100)) },
    { category: 'garbage', name: 'Garbage & Sanitation', points: issues.filter(i => i.category === 'garbage').length * 20, percent: Math.max(5, Math.round((issues.filter(i => i.category === 'garbage').length / totalIssuesByCategory) * 100)) },
    { category: 'water', name: 'Water & Plumb Patrolling', points: issues.filter(i => i.category === 'water').length * 20, percent: Math.max(5, Math.round((issues.filter(i => i.category === 'water').length / totalIssuesByCategory) * 100)) },
    { category: 'streetlight', name: 'Electrical Failure Sentry', points: issues.filter(i => i.category === 'streetlight').length * 20, percent: Math.max(5, Math.round((issues.filter(i => i.category === 'streetlight').length / totalIssuesByCategory) * 100)) },
    { category: 'safety', name: 'Public Safety Watch', points: issues.filter(i => i.category === 'safety').length * 20, percent: Math.max(5, Math.round((issues.filter(i => i.category === 'safety').length / totalIssuesByCategory) * 100)) },
  ];

  // Ranks density calculation from actual users list
  const rankCounts = {
    guardian: Math.max(1, usersList.filter(u => (u.points || 0) >= 400).length),
    ambassador: Math.max(1, usersList.filter(u => (u.points || 0) >= 250 && (u.points || 0) < 400).length),
    vigilante: Math.max(1, usersList.filter(u => (u.points || 0) >= 100 && (u.points || 0) < 250).length),
    rookie: Math.max(1, usersList.filter(u => (u.points || 0) < 100).length)
  };

  // Fetch predictive risks on mount
  useEffect(() => {
    const fetchRisks = async () => {
      setLoadingRisks(true);
      try {
        const response = await fetch('/api/predictive/risks');
        if (response.ok) {
          const data = await response.json();
          setPredictiveRisks(data);
        }
      } catch (err) {
        console.error('Failed to load predictive risks:', err);
      } finally {
        setLoadingRisks(false);
      }
    };
    fetchRisks();
  }, [issues]);

  // SLA math calculations
  const totalIssuesCount = issues.length;
  const resolvedCount = issues.filter(i => i.status === 'resolved' || i.status === 'closed').length;
  const activeCount = totalIssuesCount - resolvedCount;
  const escalatedCount = issues.filter(i => i.escalated && i.status !== 'closed').length;
  
  // Resolution rate
  const resolutionRate = totalIssuesCount > 0 ? Math.round((resolvedCount / totalIssuesCount) * 100) : 0;

  // Grouping issues by department for the chart
  const departmentsData = [
    { name: 'Roads & Asphalt', issues: issues.filter(i => i.category === 'road').length, resolved: issues.filter(i => i.category === 'road' && (i.status === 'resolved' || i.status === 'closed')).length },
    { name: 'Sanitary & Trash', issues: issues.filter(i => i.category === 'garbage').length, resolved: issues.filter(i => i.category === 'garbage' && (i.status === 'resolved' || i.status === 'closed')).length },
    { name: 'Water & Plumbing', issues: issues.filter(i => i.category === 'water').length, resolved: issues.filter(i => i.category === 'water' && (i.status === 'resolved' || i.status === 'closed')).length },
    { name: 'Electricity Board', issues: issues.filter(i => i.category === 'streetlight').length, resolved: issues.filter(i => i.category === 'streetlight' && (i.status === 'resolved' || i.status === 'closed')).length },
    { name: 'Public Safety', issues: issues.filter(i => i.category === 'safety').length, resolved: issues.filter(i => i.category === 'safety' && (i.status === 'resolved' || i.status === 'closed')).length },
  ];

  const maxIssues = Math.max(...departmentsData.map(d => d.issues), 1);

  return (
    <div className="space-y-6">

      {/* Export Header Banner */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border ${
        theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div>
          <h2 className={`text-base font-bold font-display flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            SLA Intelligence Dashboard
          </h2>
          <p className={`text-[11px] mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            Real-time municipal performance analytics &amp; predictive risk monitoring
          </p>
        </div>
        <button
          id="export-pdf-btn"
          onClick={handleExport}
          disabled={isExporting}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all cursor-pointer shadow-lg ${
            isExporting
              ? 'bg-indigo-400 cursor-wait shadow-indigo-400/20'
              : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-500/25 hover:scale-105 active:scale-95'
          }`}
        >
          {isExporting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            : <><Download className="w-4 h-4" /> Export PDF Report</>
          }
        </button>
      </div>

      {/* KPI Stats Counter row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Total complaints */}
        <div className="p-4 rounded-xl bento-card shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider font-sans ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>Total Reports</span>
            <h3 className={`text-2xl font-bold font-display ${theme === 'dark' ? 'text-white' : 'text-slate-850'}`}>{totalIssuesCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        {/* Resolution progress */}
        <div className="p-4 rounded-xl bento-card shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider font-sans ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>Resolution rate</span>
            <h3 className="text-2xl font-bold font-display text-emerald-500 dark:text-emerald-400">{resolutionRate}%</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Active Crews */}
        <div className="p-4 rounded-xl bento-card shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider font-sans ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>Active Backlog</span>
            <h3 className="text-2xl font-bold font-display text-amber-500 dark:text-amber-400">{activeCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 dark:text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* SLA breaches */}
        <div className="p-4 rounded-xl bento-card shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider font-sans ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>SLA Breaches</span>
            <h3 className="text-2xl font-bold font-display text-red-500 dark:text-red-400">{escalatedCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 dark:text-red-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* SLA Department Chart & Risk Matrix in grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Performance Chart Card */}
        <div className="lg:col-span-3 p-6 rounded-2xl bento-card shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className={`text-base font-bold font-display flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                <BarChart3 className="w-5.5 h-5.5 text-indigo-500 dark:text-indigo-400" />
                Departmental SLA Load Factor
              </h3>
              <span className="text-[10px] bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold">Consolidated SLA</span>
            </div>

            {/* Custom SVG/HTML Bar Chart (Super visual, glowing, 100% reliable) */}
            <div className="space-y-5">
              {departmentsData.map(dept => {
                const ratio = dept.issues > 0 ? Math.round((dept.resolved / dept.issues) * 100) : 0;
                const widthPercent = (dept.issues / maxIssues) * 100;

                return (
                  <div key={dept.name} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className={theme === 'dark' ? 'text-gray-350' : 'text-slate-750'}>{dept.name}</span>
                      <span className={`font-mono ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                        <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{dept.resolved}</span> resolved / <span className={theme === 'dark' ? 'text-gray-200' : 'text-slate-800'}>{dept.issues} logged</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Bar */}
                      <div className={`flex-1 h-3 rounded-full overflow-hidden relative border ${theme === 'dark' ? 'bg-slate-950 border-white/10' : 'bg-slate-200 border-slate-300/30'}`}>
                        {/* Glow back filler */}
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600 shadow-lg opacity-85 transition-all duration-700"
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                      {/* Rate label */}
                      <span className={`text-[10px] font-bold font-mono w-8 text-right ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                        {ratio}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`flex items-center gap-1.5 text-[10px] mt-6 border-t pt-3 ${theme === 'dark' ? 'text-gray-400 border-white/10' : 'text-slate-500 border-slate-200'}`}>
            <TrendingUp className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            <span>Target response SLA budget of 3 days for Sanitation, and 7 days for Potholes strictly enforced.</span>
          </div>
        </div>

        {/* Predictive Risks — Premium AI Intelligence Panel */}
        <div className="lg:col-span-2 p-6 rounded-2xl bento-card shadow-xl flex flex-col gap-4">
          {/* Panel Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
              </div>
              <div>
                <h3 className={`text-sm font-bold font-display ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                  Predictive Risk Intelligence
                </h3>
                <p className={`text-[10px] ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                  AI-powered infrastructure hazard forecast
                </p>
              </div>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 animate-pulse">
              Live AI
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto pr-0.5">
            {loadingRisks ? (
              /* Shimmer Skeleton */
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className={`p-4 rounded-xl border animate-pulse ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="space-y-1.5">
                        <div className={`h-2 w-24 rounded-full ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-300'}`} />
                        <div className={`h-3 w-40 rounded-full ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-300'}`} />
                      </div>
                      <div className={`h-6 w-16 rounded-lg ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-300'}`} />
                    </div>
                    <div className={`h-2 w-full rounded-full ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-200'}`} />
                  </div>
                ))}
              </div>
            ) : predictiveRisks.length === 0 ? (
              <div className="text-center py-8">
                <Sparkles className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>No risk signals detected.</p>
              </div>
            ) : (
              predictiveRisks.map(risk => {
                const isHigh = risk.probability >= 80;
                const isMed = risk.probability >= 60 && risk.probability < 80;
                const color = isHigh
                  ? { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', bar: 'from-rose-500 to-orange-500', badge: 'bg-rose-500/15 text-rose-400 border-rose-500/20', label: '🔴 Critical' }
                  : isMed
                  ? { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', bar: 'from-amber-400 to-yellow-500', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20', label: '🟠 High Risk' }
                  : { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', bar: 'from-cyan-400 to-blue-500', badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20', label: '🟡 Medium' };

                return (
                  <div
                    key={risk.id}
                    className={`p-4 rounded-xl border text-xs space-y-3 transition-all duration-300 hover:scale-[1.01] ${
                      theme === 'dark'
                        ? `bg-white/4 ${color.border} hover:bg-white/8`
                        : `bg-white ${color.border} shadow-sm hover:shadow-md`
                    } border`}
                  >
                    {/* Top row: zone + threat badge */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <span className={`text-[9px] font-black uppercase tracking-widest block font-mono ${theme === 'dark' ? 'text-gray-500' : 'text-slate-400'}`}>
                          📍 {risk.zone}
                        </span>
                        <h4 className={`font-bold leading-snug ${theme === 'dark' ? 'text-gray-100' : 'text-slate-800'}`}>
                          {risk.hazardType}
                        </h4>
                      </div>
                      <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-lg border ${color.badge}`}>
                        {color.label}
                      </span>
                    </div>

                    {/* Probability Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-500' : 'text-slate-400'}`}>
                          Risk Probability
                        </span>
                        <span className={`text-[11px] font-black font-mono ${color.text}`}>
                          {risk.probability}%
                        </span>
                      </div>
                      <div className={`w-full h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-100'}`}>
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${color.bar} shadow-md transition-all duration-1000`}
                          style={{ width: `${risk.probability}%` }}
                        />
                      </div>
                    </div>

                    {/* Stress Factors */}
                    <div className="space-y-1">
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-500' : 'text-slate-400'}`}>
                        Contributing Factors
                      </span>
                      <ul className="space-y-0.5">
                        {risk.factors.map((f, i) => (
                          <li key={i} className={`flex items-start gap-1.5 text-[10px] ${theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}`}>
                            <span className={`mt-0.5 shrink-0 ${color.text}`}>▸</span> {f}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Recommended Action */}
                    <div className={`flex items-start gap-2 text-[10px] font-semibold px-3 py-2 rounded-lg border ${
                      theme === 'dark' ? `${color.bg} ${color.border} ${color.text}` : `${color.bg} ${color.border} ${color.text}`
                    }`}>
                      <Zap className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>{risk.recommendedAction}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Reward Points System Analytics */}
      <div className="p-6 rounded-2xl bento-card shadow-xl space-y-4">
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
          <div>
            <h3 className={`text-base font-bold font-display flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
              <Trophy className="w-5.5 h-5.5 text-amber-500 dark:text-amber-400" />
              Civic Reward Points & Gamification Analytics
            </h3>
            <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
              Analyzing distributed incentive tokens, karma growth, and user participation multipliers.
            </p>
          </div>
          <div className="flex gap-2.5">
            <div className="bg-amber-500/10 border border-amber-500/25 px-3.5 py-1.5 rounded-xl text-center">
              <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Total Points Distributed</div>
              <div className={`text-sm font-black font-mono mt-0.5 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{totalPoints} Pts</div>
            </div>
            <div className="bg-indigo-500/10 border border-indigo-500/25 px-3.5 py-1.5 rounded-xl text-center">
              <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Avg Points / Citizen</div>
              <div className={`text-sm font-black font-mono mt-0.5 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{avgPoints} Pts</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Points by Category */}
          <div className={`p-4 rounded-xl border space-y-3 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
              <Sparkles className="w-4 h-4 text-indigo-500 dark:text-indigo-400" /> Points Earned by Category
            </h4>
            <div className="space-y-2.5">
              {categoryPointsData.map(item => (
                <div key={item.category} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}>{item.name}</span>
                    <span className={`font-bold font-mono ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{item.points} Pts ({item.percent}%)</span>
                  </div>
                  <div className={`w-full h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-200'}`}>
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-amber-450 to-orange-500" 
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Points Milestones & Achievements */}
          <div className={`p-4 rounded-xl border space-y-3 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
              <Award className="w-4 h-4 text-amber-500 dark:text-amber-400" /> Solver Rank Density
            </h4>
            <div className="space-y-3 text-xs">
              <div className={`flex items-center justify-between p-2 rounded-lg ${theme === 'dark' ? 'bg-slate-950/40' : 'bg-white border border-slate-200/60 shadow-xs'}`}>
                <span className={`flex items-center gap-2 ${theme === 'dark' ? 'text-gray-200' : 'text-slate-750'}`}>👑 District Guardian <span className={`text-[10px] ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>(400+ Pts)</span></span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">{rankCounts.guardian} Users</span>
              </div>
              <div className={`flex items-center justify-between p-2 rounded-lg ${theme === 'dark' ? 'bg-slate-950/40' : 'bg-white border border-slate-200/60 shadow-xs'}`}>
                <span className={`flex items-center gap-2 ${theme === 'dark' ? 'text-gray-200' : 'text-slate-750'}`}>🏅 Neighborhood Ambassador <span className={`text-[10px] ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>(250-399)</span></span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">{rankCounts.ambassador} Users</span>
              </div>
              <div className={`flex items-center justify-between p-2 rounded-lg ${theme === 'dark' ? 'bg-slate-950/40' : 'bg-white border border-slate-200/60 shadow-xs'}`}>
                <span className={`flex items-center gap-2 ${theme === 'dark' ? 'text-gray-200' : 'text-slate-750'}`}>🕵️ Local Vigilante <span className={`text-[10px] ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>(100-249)</span></span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">{rankCounts.vigilante} Users</span>
              </div>
              <div className={`flex items-center justify-between p-2 rounded-lg ${theme === 'dark' ? 'bg-slate-950/40' : 'bg-white border border-slate-200/60 shadow-xs'}`}>
                <span className={`flex items-center gap-2 ${theme === 'dark' ? 'text-gray-200' : 'text-slate-750'}`}>🌱 Civic Rookie <span className={`text-[10px] ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>(0-99)</span></span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">{rankCounts.rookie} Users</span>
              </div>
            </div>
          </div>

          {/* Live System Multipliers */}
          <div className={`p-4 rounded-xl border space-y-3 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}`}>
              <Zap className="w-4 h-4 text-yellow-500 dark:text-yellow-400 animate-pulse" /> Neighborhood Multipliers
            </h4>
            <div className="space-y-2 text-xs">
              <div className={`p-2.5 rounded-lg flex items-center justify-between border ${theme === 'dark' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
                <div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">Pothole Patrol Active</div>
                  <div className={`text-[10px] ${theme === 'dark' ? 'text-gray-400' : 'text-emerald-700/80'}`}>Road issues validation is boosted</div>
                </div>
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-800'}`}>1.5x Multiplier</span>
              </div>

              <div className={`p-2.5 rounded-lg flex items-center justify-between border ${theme === 'dark' ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
                <div>
                  <div className="font-bold text-indigo-600 dark:text-indigo-400">Civic Mentor Level</div>
                  <div className={`text-[10px] ${theme === 'dark' ? 'text-gray-400' : 'text-indigo-700/80'}`}>High trust users validation bonus</div>
                </div>
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-100 text-indigo-850'}`}>1.2x Multiplier</span>
              </div>

              <div className={`p-2.5 rounded-lg flex items-center justify-between border ${theme === 'dark' ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-amber-50 border-amber-200/60'}`}>
                <div>
                  <div className="font-bold text-amber-600 dark:text-yellow-500">Flash Sentry Active</div>
                  <div className={`text-[10px] ${theme === 'dark' ? 'text-gray-400' : 'text-amber-700/80'}`}>Verification during off-peak hours</div>
                </div>
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-amber-100 text-amber-800'}`}>2.0x Multiplier</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
