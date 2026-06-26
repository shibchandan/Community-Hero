import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Issue, IssueCategory, IssueStatus } from '../types';
import { 
  BarChart3, PieChart, TrendingUp, Clock, 
  AlertTriangle, Shield, CheckCircle2, Zap
} from 'lucide-react';

const getCategoryColor = (cat: IssueCategory) => {
  switch (cat) {
    case 'road': return 'from-amber-400 to-amber-600';
    case 'garbage': return 'from-emerald-400 to-emerald-600';
    case 'water': return 'from-sky-400 to-sky-600';
    case 'streetlight': return 'from-yellow-300 to-amber-500';
    case 'safety': return 'from-rose-400 to-red-600';
    default: return 'from-indigo-400 to-indigo-600';
  }
};

interface AnalyticsDashboardProps {
  issues: Issue[];
  theme: 'dark' | 'light';
}

export default function AnalyticsDashboard({ issues, theme }: AnalyticsDashboardProps) {
  // Aggregate data
  const totalIssues = issues.length;
  const resolvedIssues = issues.filter(i => i.status === 'resolved' || i.status === 'closed').length;
  const resolutionRate = totalIssues === 0 ? 0 : Math.round((resolvedIssues / totalIssues) * 100);
  
  const avgSlaTimeDays = useMemo(() => {
    const resolved = issues.filter(i => i.status === 'resolved' || i.status === 'closed');
    if (resolved.length === 0) return 0;
    
    let totalDays = 0;
    resolved.forEach(issue => {
      const created = new Date(issue.createdAt).getTime();
      const resolvedAt = issue.resolvedAt ? new Date(issue.resolvedAt).getTime() : new Date().getTime();
      const diffDays = (resolvedAt - created) / (1000 * 3600 * 24);
      totalDays += diffDays;
    });
    return Number((totalDays / resolved.length).toFixed(1));
  }, [issues]);

  const communityValidations = issues.reduce((acc, issue) => acc + (issue.votedUsers ? Object.keys(issue.votedUsers).length : 0), 0);

  // Status Distribution
  const statusCounts = useMemo(() => {
    const counts: Record<IssueStatus, number> = {
      reported: 0, ai_verified: 0, community_verified: 0, 
      assigned: 0, in_progress: 0, resolved: 0, closed: 0
    };
    issues.forEach(issue => {
      if (counts[issue.status] !== undefined) {
        counts[issue.status]++;
      }
    });
    return counts;
  }, [issues]);

  // Category Distribution
  const categoryCounts = useMemo(() => {
    const counts = {} as Record<IssueCategory, number>;
    issues.forEach(issue => {
      counts[issue.category] = (counts[issue.category] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [issues]);

  const maxCategoryCount = categoryCounts.length > 0 ? categoryCounts[0][1] : 1;

  // Monthly Trend (dynamic computation)
  const monthlyTrend = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const countsByMonth: Record<string, number> = {};
    
    // Initialize last 6 months
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      countsByMonth[monthNames[m.getMonth()]] = 0;
    }
    
    issues.forEach(issue => {
      const date = new Date(issue.createdAt);
      const monthStr = monthNames[date.getMonth()];
      if (countsByMonth[monthStr] !== undefined) {
        countsByMonth[monthStr]++;
      }
    });
    
    return Object.entries(countsByMonth).map(([month, count]) => ({ month, count }));
  }, [issues]);

  const maxTrend = Math.max(1, ...monthlyTrend.map(d => d.count));

  const StatCard = ({ title, value, subtitle, icon: Icon, colorClass }: any) => (
    <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bento-card bg-slate-900/50' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{title}</p>
          <h3 className={`text-3xl font-black font-mono ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{value}</h3>
          <p className={`text-[10px] font-medium mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{subtitle}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className={`text-2xl font-black font-display tracking-tight flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <BarChart3 className="w-6 h-6 text-indigo-500" />
            Admin Analytics Overview
          </h1>
          <p className={`text-xs mt-1 font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            Comprehensive real-time insights into municipal performance and civic engagement.
          </p>
        </div>
        <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${
          theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
        }`}>
          <Zap className="w-4 h-4" /> Live Data Sync Active
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Reports" 
          value={totalIssues} 
          subtitle="+12% from last month" 
          icon={AlertTriangle} 
          colorClass="bg-amber-500/20 text-amber-500" 
        />
        <StatCard 
          title="Resolution Rate" 
          value={`${resolutionRate}%`} 
          subtitle="Target: 85%" 
          icon={CheckCircle2} 
          colorClass="bg-emerald-500/20 text-emerald-500" 
        />
        <StatCard 
          title="Avg SLA Time" 
          value={`${avgSlaTimeDays}d`} 
          subtitle="-0.5 days vs last quarter" 
          icon={Clock} 
          colorClass="bg-cyan-500/20 text-cyan-500" 
        />
        <StatCard 
          title="Civic Validations" 
          value={communityValidations} 
          subtitle="Community trust interactions" 
          icon={Shield} 
          colorClass="bg-violet-500/20 text-violet-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Breakdown (Bar Chart) */}
        <div className={`lg:col-span-2 p-6 rounded-2xl border ${theme === 'dark' ? 'bento-card bg-slate-900/50' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-sm font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              <PieChart className="w-4 h-4 text-indigo-500" /> Issues by Category
            </h3>
          </div>
          <div className="space-y-4">
            {categoryCounts.map(([cat, count]) => {
              const percentage = Math.round((count / maxCategoryCount) * 100);
              const color = getCategoryColor(cat as IssueCategory);
              
              return (
                <div key={cat} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className={theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}>{cat}</span>
                    <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>{count} ({Math.round((count/totalIssues)*100)}%)</span>
                  </div>
                  <div className={`w-full h-3 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full rounded-full bg-gradient-to-r ${color}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status Breakdown (Donut-like list) */}
        <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bento-card bg-slate-900/50' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h3 className={`text-sm font-bold flex items-center gap-2 mb-6 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Pipeline Status
          </h3>
          <div className="space-y-3">
            {[
              { status: 'reported', label: 'Reported', color: 'bg-slate-400' },
              { status: 'ai_verified', label: 'AI Verified', color: 'bg-violet-500' },
              { status: 'community_verified', label: 'Civic Verified', color: 'bg-blue-500' },
              { status: 'assigned', label: 'Assigned', color: 'bg-indigo-500' },
              { status: 'in_progress', label: 'In Progress', color: 'bg-amber-500' },
              { status: 'resolved', label: 'Resolved', color: 'bg-emerald-500' },
              { status: 'closed', label: 'Closed', color: 'bg-slate-600' }
            ].map(item => {
              const count = statusCounts[item.status as IssueStatus] || 0;
              const percentage = totalIssues === 0 ? 0 : Math.round((count / totalIssues) * 100);
              
              return (
                <div key={item.status} className={`p-3 rounded-xl border flex items-center justify-between ${
                  theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${item.color} shadow-sm shadow-${item.color}/50`} />
                    <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{item.label}</span>
                  </div>
                  <div className="text-right">
                    <span className={`block text-sm font-black font-mono ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{count}</span>
                    <span className={`block text-[9px] font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly Trend Chart */}
        <div className={`lg:col-span-3 p-6 rounded-2xl border ${theme === 'dark' ? 'bento-card bg-slate-900/50' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h3 className={`text-sm font-bold flex items-center gap-2 mb-8 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <TrendingUp className="w-4 h-4 text-cyan-500" /> Reporting Trend (6 Months)
          </h3>
          <div className="h-48 flex items-end justify-between gap-2 px-2 pb-6 border-b border-dashed border-slate-200 dark:border-white/10 relative">
            
            {/* Y-axis lines (simulated) */}
            <div className="absolute left-0 top-0 w-full border-t border-dashed border-slate-200 dark:border-white/5"></div>
            <div className="absolute left-0 top-1/2 w-full border-t border-dashed border-slate-200 dark:border-white/5"></div>
            
            {monthlyTrend.map((data, i) => {
              const heightPercent = maxTrend === 0 ? 0 : (data.count / maxTrend) * 100;
              return (
                <div key={data.month} className="flex flex-col items-center flex-1 group z-10">
                  <div className="w-full flex justify-center h-full items-end">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${heightPercent}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                      className={`w-full max-w-[48px] rounded-t-lg bg-gradient-to-t ${
                        theme === 'dark' 
                          ? 'from-indigo-600/50 to-cyan-400 group-hover:to-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.2)]' 
                          : 'from-indigo-500/20 to-indigo-500 group-hover:to-indigo-400 shadow-sm'
                      } relative transition-all`}
                    >
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded bg-black/80 text-white`}>{data.count}</span>
                      </div>
                    </motion.div>
                  </div>
                  <span className={`text-[10px] font-bold mt-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{data.month}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
