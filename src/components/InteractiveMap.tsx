/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Issue, IssueCategory } from '../types';
import { MapPin, Info, AlertTriangle, Shield, CheckCircle2, Waves, Trash2, Sliders, Eye } from 'lucide-react';

interface InteractiveMapProps {
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
  selectedIssueId?: string;
}

export default function InteractiveMap({ issues, onSelectIssue, selectedIssueId }: InteractiveMapProps) {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [heatmapMode, setHeatmapMode] = useState<boolean>(false);
  const [hoveredIssue, setHoveredIssue] = useState<Issue | null>(null);

  // Approximate SF bounding box for mapping GPS coordinates to SVG coordinate space (1000x600)
  // Lat range: 37.755 to 37.785
  // Lng range: -122.430 to -122.405
  const mapCoords = (lat: number, lng: number) => {
    const minLat = 37.755;
    const maxLat = 37.785;
    const minLng = -122.430;
    const maxLng = -122.405;

    // Convert to percentage
    const x = ((lng - minLng) / (maxLng - minLng)) * 1000;
    // Invert Y because SVG coordinates start from top-left
    const y = (1 - (lat - minLat) / (maxLat - minLat)) * 600;

    // Keep within bounds
    return {
      x: Math.max(20, Math.min(980, x)),
      y: Math.max(20, Math.min(580, y))
    };
  };

  const getCategoryColor = (cat: IssueCategory) => {
    switch (cat) {
      case 'road': return 'from-amber-400 to-amber-600';
      case 'garbage': return 'from-emerald-400 to-emerald-600';
      case 'water': return 'from-sky-400 to-sky-600';
      case 'streetlight': return 'from-yellow-300 to-amber-500';
      case 'safety': return 'from-rose-400 to-red-600';
    }
  };

  const getCategoryEmoji = (cat: IssueCategory) => {
    switch (cat) {
      case 'road': return '⚠️';
      case 'garbage': return '🗑️';
      case 'water': return '🚰';
      case 'streetlight': return '💡';
      case 'safety': return '🚨';
    }
  };

  // Filter issues
  const filteredIssues = issues.filter(issue => {
    const matchesCat = filterCategory === 'all' || issue.category === filterCategory;
    const matchesSev = filterSeverity === 'all' || issue.severity === filterSeverity;
    return matchesCat && matchesSev;
  });

  return (
    <div className="relative w-full overflow-hidden bento-card shadow-2xl transition-all duration-300">
      
      {/* Map Control Header */}
      <div className="p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center border-b border-white/10 bg-white/5 backdrop-blur-md">
        <div>
          <h3 className="text-lg font-bold font-display text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            Hyperlocal Geolocation Radar
          </h3>
          <p className="text-xs text-gray-400">Civic issues plotted in real-time coordinates</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {/* Category */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">📁 All Categories</option>
            <option value="road">🚧 Road Damage</option>
            <option value="garbage">🚮 Garbage Overflow</option>
            <option value="water">💧 Water Leakage</option>
            <option value="streetlight">💡 Streetlight Out</option>
            <option value="safety">🚨 Public Safety</option>
          </select>

          {/* Severity */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">⚡ All Severities</option>
            <option value="high">🔴 High Urgency</option>
            <option value="medium">🟡 Medium Urgency</option>
            <option value="low">🟢 Low Urgency</option>
          </select>

          {/* Heatmap Toggle */}
          <button
            onClick={() => setHeatmapMode(!heatmapMode)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all duration-300 ${
              heatmapMode
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-rose-500/25'
                : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            {heatmapMode ? 'Thermal Density Mode' : 'Standard Pin Mode'}
          </button>
        </div>
      </div>

      {/* Main Map SVG Canvas */}
      <div className="relative w-full aspect-[1000/600] min-h-[350px] bg-[#070913] overflow-hidden select-none">
        
        {/* Animated Background Gradients to emulate high premium look from the screenshots */}
        <div className="absolute inset-0 opacity-40 dark:opacity-60 pointer-events-none transition-all duration-300">
          <div className="absolute top-[20%] left-[30%] w-72 h-72 rounded-full bg-indigo-500/20 blur-[100px] animate-pulse"></div>
          <div className="absolute bottom-[20%] right-[25%] w-80 h-80 rounded-full bg-emerald-500/10 blur-[120px] animate-pulse"></div>
          <div className="absolute top-[60%] right-[10%] w-64 h-64 rounded-full bg-rose-500/10 blur-[90px] animate-pulse"></div>
        </div>

        {/* Dynamic Sweeping Radar Beam */}
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden mix-blend-screen opacity-15">
          <div 
            className="absolute w-[200%] h-[200%] top-[-50%] left-[-50%] rounded-full animate-radar-sweep"
            style={{
              background: 'conic-gradient(from 0deg, rgba(99, 102, 241, 0.4) 0deg, rgba(99, 102, 241, 0.05) 60deg, transparent 180deg)',
            }}
          />
        </div>

        {/* Dynamic Sonar Rings / Concentric Circular Grids */}
        <div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center opacity-10">
          <div className="absolute w-[20%] h-[33%] rounded-full border border-indigo-500/40 animate-pulse" />
          <div className="absolute w-[40%] h-[66%] rounded-full border border-indigo-500/25" />
          <div className="absolute w-[60%] h-[100%] rounded-full border border-indigo-500/20" />
          <div className="absolute w-[80%] h-[133%] rounded-full border border-indigo-500/10" />
        </div>

        {/* SVG Drawing of Streets, Parks, Channels */}
        <svg viewBox="0 0 1000 600" className="w-full h-full stroke-slate-300/40 dark:stroke-slate-800/40 stroke-[1.5] fill-none">
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" className="stroke-slate-200/50 dark:stroke-slate-900/30" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="1000" height="600" fill="url(#grid)" stroke="none" />

          {/* Parks Area */}
          <polygon points="120,40 280,30 310,180 150,220" className="fill-emerald-500/10 dark:fill-emerald-500/5 stroke-emerald-500/20" strokeWidth="1" />
          <text x="190" y="110" className="fill-emerald-600/40 dark:fill-emerald-500/20 text-[10px] font-medium font-sans italic" stroke="none">Mission Park Square</text>

          <polygon points="650,450 850,420 880,560 700,580" className="fill-indigo-500/10 dark:fill-indigo-500/5 stroke-indigo-500/20" strokeWidth="1" />
          <text x="740" y="500" className="fill-indigo-600/40 dark:fill-indigo-500/20 text-[10px] font-medium font-sans italic" stroke="none">SOMA Tech Green</text>

          {/* Waterway / Channel */}
          <path d="M -10,320 C 150,300 280,380 410,350 C 550,320 620,180 780,140 C 900,110 950,50 1020,40" className="stroke-sky-400/30 dark:stroke-sky-500/20" strokeWidth="16" fill="none" />
          <path d="M -10,320 C 150,300 280,380 410,350 C 550,320 620,180 780,140 C 900,110 950,50 1020,40" className="stroke-sky-300/20 dark:stroke-sky-600/10" strokeWidth="32" fill="none" />
          <text x="460" y="325" className="fill-sky-600/40 dark:fill-sky-400/20 text-[10px] font-medium font-sans italic" stroke="none" transform="rotate(-6, 460, 325)">Mission Creek Channel</text>

          {/* Main Roads network */}
          {/* Diagonal Hwy */}
          <path d="M 50,-20 L 950,620" className="stroke-slate-300/50 dark:stroke-slate-800/80" strokeWidth="8" />
          <path d="M 50,-20 L 950,620" className="stroke-white dark:stroke-slate-900/60" strokeWidth="2" strokeDasharray="6 4" />

          {/* Horizontal Market Blvd */}
          <path d="M -20,150 L 1020,150" className="stroke-slate-300/60 dark:stroke-slate-800/80" strokeWidth="10" />
          <path d="M -20,150 L 1020,150" className="stroke-amber-500/20 dark:stroke-indigo-500/20" strokeWidth="4" />
          <path d="M -20,150 L 1020,150" className="stroke-slate-100 dark:stroke-slate-900/40" strokeWidth="1" strokeDasharray="8 6" />
          <text x="80" y="140" className="fill-slate-400 dark:fill-slate-500 text-[9px] font-mono tracking-wider uppercase" stroke="none">Market Street (Transit Blvd)</text>

          {/* Vertical Valencia Corridor */}
          <path d="M 450,-20 L 450,620" className="stroke-slate-300/60 dark:stroke-slate-800/80" strokeWidth="8" />
          <path d="M 450,-20 L 450,620" className="stroke-slate-100 dark:stroke-slate-900/40" strokeWidth="1" strokeDasharray="8 6" />
          <text x="460" y="550" className="fill-slate-400 dark:fill-slate-500 text-[9px] font-mono tracking-wider uppercase" stroke="none" transform="rotate(90, 460, 550)">Valencia Ave</text>

          {/* Grid Street 1 */}
          <path d="M 220,-20 L 220,620" className="stroke-slate-200/40 dark:stroke-slate-900/40" strokeWidth="4" />
          {/* Grid Street 2 */}
          <path d="M 750,-20 L 750,620" className="stroke-slate-200/40 dark:stroke-slate-900/40" strokeWidth="4" />
          {/* Grid Street 3 */}
          <path d="M -20,400 L 1020,400" className="stroke-slate-200/40 dark:stroke-slate-900/40" strokeWidth="4" />
        </svg>

        {/* Heatmap Overlay */}
        {heatmapMode && (
          <div className="absolute inset-0 pointer-events-none transition-all duration-500 bg-black/15 dark:bg-black/30 backdrop-blur-[1px]">
            {filteredIssues.map((issue) => {
              const { x, y } = mapCoords(issue.location.lat, issue.location.lng);
              const color = issue.severity === 'high' ? 'rgba(239, 68, 68, 0.45)' : issue.severity === 'medium' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.25)';
              return (
                <div
                  key={`heat-${issue.id}`}
                  className="absolute rounded-full transition-all duration-500 transform -translate-x-1/2 -translate-y-1/2 animate-ping"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    width: issue.severity === 'high' ? '120px' : '80px',
                    height: issue.severity === 'high' ? '120px' : '80px',
                    background: `radial-gradient(circle, ${color} 0%, rgba(0,0,0,0) 70%)`,
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Geolocation Markers */}
        {filteredIssues.map((issue) => {
          const { x, y } = mapCoords(issue.location.lat, issue.location.lng);
          const isSelected = selectedIssueId === issue.id;
          const gradient = getCategoryColor(issue.category);
          const emoji = getCategoryEmoji(issue.category);

          return (
            <div
              key={issue.id}
              className="absolute group z-10 cursor-pointer transition-all duration-300 transform -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${(x / 1000) * 100}%`,
                top: `${(y / 600) * 100}%`,
              }}
              onClick={() => onSelectIssue(issue)}
              onMouseEnter={() => setHoveredIssue(issue)}
              onMouseLeave={() => setHoveredIssue(null)}
            >
              {/* Pulsing ring for high severity */}
              {issue.severity === 'high' && issue.status !== 'closed' && (
                <div className="absolute inset-0 -m-3 rounded-full bg-red-500/25 animate-ping opacity-60 pointer-events-none" />
              )}

              {/* Sonar Ripple for active issues */}
              {issue.status !== 'closed' && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border border-indigo-500/30 bg-indigo-500/5 pointer-events-none animate-sonar-ripple" />
              )}

              {/* Glowing anchor effect for selection */}
              {isSelected && (
                <div className="absolute inset-0 -m-4 rounded-full bg-indigo-500/30 blur-md animate-pulse" />
              )}

              {/* Actual Pin UI */}
              <div className={`relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br shadow-lg border-2 text-sm transition-all duration-300 ${
                isSelected 
                  ? 'border-white dark:border-indigo-400 scale-125 z-20 shadow-indigo-500/40 ring-4 ring-indigo-500/20' 
                  : 'border-white/80 dark:border-slate-800 scale-100 hover:scale-115 hover:z-20'
              } ${gradient}`}>
                <span className="select-none text-base">{emoji}</span>
                
                {/* Visual indicator of validation status */}
                {issue.status === 'community_verified' && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white border border-white">
                    ✓
                  </span>
                )}
                {issue.status === 'resolved' && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-white border border-white">
                    ✓
                  </span>
                )}
                {issue.escalated && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-600 text-[7px] font-bold text-white border border-white animate-pulse">
                    🚨
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Hover Tooltip Overlay */}
        {hoveredIssue && (
          <div
            className="absolute z-40 p-3 rounded-xl shadow-2xl backdrop-blur-md bg-slate-900/90 border border-slate-700 pointer-events-none max-w-[280px]"
            style={{
              left: `${Math.min(80, Math.max(5, (mapCoords(hoveredIssue.location.lat, hoveredIssue.location.lng).x / 1000) * 100))}%`,
              top: `${Math.min(75, Math.max(5, (mapCoords(hoveredIssue.location.lat, hoveredIssue.location.lng).y / 600) * 100 + 4))}%`,
            }}
          >
            <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              <span className={`px-1.5 py-0.5 rounded text-white bg-gradient-to-r ${getCategoryColor(hoveredIssue.category)}`}>
                {hoveredIssue.category}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-white ${
                hoveredIssue.severity === 'high' ? 'bg-red-500' : hoveredIssue.severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
              }`}>
                {hoveredIssue.severity}
              </span>
            </div>
            <h4 className="text-xs font-bold text-white truncate">{hoveredIssue.title}</h4>
            <p className="text-[10px] text-slate-300 mt-1 line-clamp-2">{hoveredIssue.description}</p>
            <div className="flex justify-between items-center mt-2 border-t border-slate-800 pt-1.5 text-[9px] text-slate-400">
              <span className="truncate">{hoveredIssue.location.address}</span>
              <span className="text-emerald-400 font-bold ml-2">Score: {hoveredIssue.upvotes - hoveredIssue.downvotes}</span>
            </div>
          </div>
        )}

        {/* Instructions Panel */}
        <div className="absolute bottom-3 right-3 p-3 rounded-xl bg-[#0a0c14]/90 backdrop-blur-md border border-white/10 shadow-lg text-[10px] text-gray-300 pointer-events-none">
          <div className="font-bold mb-1 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-indigo-500" />
            Legend
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <span className="flex items-center gap-1">⚠️ Road</span>
            <span className="flex items-center gap-1">🗑️ Waste</span>
            <span className="flex items-center gap-1">🚰 Water Leak</span>
            <span className="flex items-center gap-1">💡 Lighting</span>
            <span className="flex items-center gap-1">🚨 Safety</span>
            <span className="flex items-center gap-1">✓ Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
}
