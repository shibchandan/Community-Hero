/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Issue, IssueCategory } from '../types';
import { BarChart3, TrendingUp, AlertOctagon, Sparkles, Building2, ShieldAlert, CheckCircle, Clock } from 'lucide-react';

interface SlaDashboardProps {
  issues: Issue[];
}

interface PredictiveRisk {
  id: string;
  zone: string;
  hazardType: string;
  probability: number;
  factors: string[];
  recommendedAction: string;
}

export default function SlaDashboard({ issues }: SlaDashboardProps) {
  const [predictiveRisks, setPredictiveRisks] = useState<PredictiveRisk[]>([]);
  const [loadingRisks, setLoadingRisks] = useState(false);

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
      
      {/* KPI Stats Counter row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Total complaints */}
        <div className="p-4 rounded-xl bento-card shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-sans">Total Reports</span>
            <h3 className="text-2xl font-bold font-display text-white">{totalIssuesCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        {/* Resolution progress */}
        <div className="p-4 rounded-xl bento-card shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-sans">Resolution rate</span>
            <h3 className="text-2xl font-bold font-display text-emerald-400">{resolutionRate}%</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Active Crews */}
        <div className="p-4 rounded-xl bento-card shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-sans">Active Backlog</span>
            <h3 className="text-2xl font-bold font-display text-amber-400">{activeCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* SLA breaches */}
        <div className="p-4 rounded-xl bento-card shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-sans">SLA Breaches</span>
            <h3 className="text-2xl font-bold font-display text-red-400">{escalatedCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
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
              <h3 className="text-base font-bold font-display text-white flex items-center gap-2">
                <BarChart3 className="w-5.5 h-5.5 text-indigo-400" />
                Departmental SLA Load Factor
              </h3>
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-bold">Consolidated SLA SLA</span>
            </div>

            {/* Custom SVG/HTML Bar Chart (Super visual, glowing, 100% reliable) */}
            <div className="space-y-5">
              {departmentsData.map(dept => {
                const ratio = dept.issues > 0 ? Math.round((dept.resolved / dept.issues) * 100) : 0;
                const widthPercent = (dept.issues / maxIssues) * 100;

                return (
                  <div key={dept.name} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-300">{dept.name}</span>
                      <span className="text-gray-400 font-mono">
                        <span className="text-indigo-400 font-extrabold">{dept.resolved}</span> resolved / <span className="text-gray-200">{dept.issues} logged</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Bar */}
                      <div className="flex-1 h-3 rounded-full bg-slate-950 overflow-hidden relative border border-white/10">
                        {/* Glow back filler */}
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600 shadow-lg opacity-85 transition-all duration-700"
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                      {/* Rate label */}
                      <span className="text-[10px] font-bold text-gray-400 font-mono w-8 text-right">
                        {ratio}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-6 border-t border-white/10 pt-3">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            <span>Target response SLA budget of 3 days for Sanitation, and 7 days for Potholes strictly enforced.</span>
          </div>
        </div>

        {/* Predictive Risks Cards */}
        <div className="lg:col-span-2 p-6 rounded-2xl bento-card shadow-xl flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5.5 h-5.5 text-violet-400 animate-pulse" />
            <h3 className="text-base font-bold font-display text-white font-sans">Predictive Infrastructure Risks</h3>
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto max-h-[320px] pr-1">
            {loadingRisks ? (
              <span className="text-xs text-gray-400 italic block text-center py-8">Fetching real-time predictive data...</span>
            ) : predictiveRisks.length === 0 ? (
              <span className="text-xs text-gray-400 italic block text-center py-8">No risks mapped.</span>
            ) : (
              predictiveRisks.map(risk => (
                <div 
                  key={risk.id} 
                  className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs space-y-2 relative overflow-hidden"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block font-mono">{risk.zone}</span>
                      <h4 className="font-bold text-gray-200 text-xs">{risk.hazardType}</h4>
                    </div>
                    <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/25 animate-pulse">
                      {risk.probability}% Prob
                    </span>
                  </div>

                  {/* Factor Bullets */}
                  <div className="space-y-1">
                    <span className="text-[8px] font-extrabold uppercase tracking-wide text-gray-400">Environmental Stress Factors</span>
                    <ul className="list-disc list-inside text-[10px] text-gray-400 space-y-0.5 pl-0.5">
                      {risk.factors.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Recommended preventative action */}
                  <div className="mt-2 text-[9px] text-violet-400 font-bold uppercase tracking-wider bg-violet-500/5 px-2 py-1 rounded border border-violet-500/10">
                    Proactive Action: {risk.recommendedAction}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
