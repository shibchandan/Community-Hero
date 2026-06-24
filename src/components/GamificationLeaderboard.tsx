/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { User } from '../types';
import { Award, Trophy, Star, Shield, Zap, Sparkles, CheckCircle, Info } from 'lucide-react';

interface GamificationLeaderboardProps {
  currentUser: User;
  usersList: User[];
}

export default function GamificationLeaderboard({ currentUser, usersList }: GamificationLeaderboardProps) {
  // Sort users list by points
  const sortedLeaderboard = [...usersList].sort((a, b) => b.points - a.points);

  const getRankName = (points: number) => {
    if (points >= 400) return 'District Guardian';
    if (points >= 250) return 'Neighborhood Ambassador';
    if (points >= 100) return 'Local Vigilante';
    return 'Civic Rookie';
  };

  const getBadgeIcon = (badge: string) => {
    switch (badge) {
      case 'Local Hero': return '🏆';
      case 'Pothole Patrol': return '🚧';
      case 'Street Light Sentry': return '💡';
      case 'Waste Warden': return '🚮';
      case 'Civic Legend': return '⭐';
      case 'Supreme Validator': return '🕵️';
      case 'SLA Champion': return '🎖️';
      default: return '🏅';
    }
  };

  const getPointsNeededForNextRank = (points: number) => {
    if (points >= 400) return 0;
    if (points >= 250) return 400 - points;
    if (points >= 100) return 250 - points;
    return 100 - points;
  };

  const getNextRankName = (points: number) => {
    if (points >= 400) return 'Max Rank Reached';
    if (points >= 250) return 'District Guardian';
    if (points >= 100) return 'Neighborhood Ambassador';
    return 'Local Vigilante';
  };

  const currentPointsNeeded = getPointsNeededForNextRank(currentUser.points);
  const nextRank = getNextRankName(currentUser.points);
  const currentRankRange = currentUser.points >= 400 ? 100 : (currentUser.points >= 250 ? 400 - 250 : (currentUser.points >= 100 ? 250 - 100 : 100));
  const currentLevelProgress = currentPointsNeeded === 0 ? 100 : ((currentRankRange - currentPointsNeeded) / currentRankRange) * 100;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Citizen Personal Hero Stats card */}
      <div className="lg:col-span-1 p-6 rounded-2xl bento-card shadow-xl flex flex-col justify-between h-fit space-y-6">
        <div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">Personal Rank</span>
              <h3 className="text-xl font-bold font-display text-white mt-1">{getRankName(currentUser.points)}</h3>
              <span className="text-xs text-slate-400 font-mono">ID: {currentUser.name}</span>
            </div>
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl shadow-lg">
              🎖️
            </div>
          </div>

          {/* Level Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-gray-300">Level Progression</span>
              <span className="text-indigo-400 font-bold">{currentUser.points} / {currentUser.points + currentPointsNeeded} Pts</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500"
                style={{ width: `${currentLevelProgress}%` }}
              />
            </div>
            {currentPointsNeeded > 0 && (
              <p className="text-[10px] text-gray-400 mt-1">
                Collect <span className="font-bold text-gray-300">{currentPointsNeeded} more points</span> to unlock the rank of <span className="text-indigo-400 font-bold">{nextRank}</span>.
              </p>
            )}
          </div>
        </div>

        {/* Badges Section */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1 font-sans">
            <Award className="w-4 h-4 text-amber-400" />
            My Active Badges ({currentUser.badges?.length || 0})
          </h4>
          <div className="flex flex-wrap gap-2.5">
            {currentUser.badges?.map(b => (
              <div key={b} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-200 font-medium animate-fadeIn">
                <span className="text-base select-none">{getBadgeIcon(b)}</span>
                <span>{b}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Reputation Multipliers Information */}
        <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-[10px] text-gray-400 space-y-2">
          <span className="font-bold text-white uppercase tracking-wider text-[9px] block">Civic Karma Actions Guide</span>
          <div className="grid grid-cols-2 gap-y-1.5">
            <span>🚧 File Report:</span> <span className="font-bold text-emerald-400 text-right">+20 Pts</span>
            <span>🕵️ Validate Issue:</span> <span className="font-bold text-emerald-400 text-right">+10 Pts</span>
            <span>✓ Community Verified:</span> <span className="font-bold text-emerald-400 text-right">+30 Pts</span>
            <span>💬 Write Advice:</span> <span className="font-bold text-emerald-400 text-right">+2 Pts</span>
          </div>
        </div>
      </div>

      {/* Leaderboard Table Grid */}
      <div className="lg:col-span-2 p-6 rounded-2xl bento-card shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-bold font-display text-white flex items-center gap-2">
              <Trophy className="w-5.5 h-5.5 text-yellow-500" />
              Neighborhood Civic Solvers
            </h3>
            <span className="text-[10px] text-gray-400 font-mono">Updated real-time</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-200">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="py-2">Rank</th>
                  <th className="py-2">Citizen Solver</th>
                  <th className="py-2">Active Sector</th>
                  <th className="py-2 text-right">Trust Score</th>
                  <th className="py-2 text-right">Civic points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedLeaderboard.map((u, index) => {
                  const isCurrentUser = u.id === currentUser.id;
                  const rankIcons = ['🥇', '🥈', '🥉'];
                  
                  return (
                    <tr 
                      key={u.id} 
                      className={`hover:bg-white/5 transition-all ${
                        isCurrentUser ? 'bg-indigo-500/10 font-bold text-white' : ''
                      }`}
                    >
                      <td className="py-3 font-bold font-mono">
                        {index < 3 ? (
                          <span className="text-base">{rankIcons[index]}</span>
                        ) : (
                          <span className="pl-1.5 text-gray-400">#{index + 1}</span>
                        )}
                      </td>
                      <td className="py-3 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center font-bold text-gray-300 border border-white/10">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <span>{u.name}</span>
                          {isCurrentUser && <span className="text-[8px] bg-indigo-500 text-white font-bold ml-1.5 px-1 rounded uppercase">Me</span>}
                        </div>
                      </td>
                      <td className="py-3 text-gray-400 font-medium">
                        {u.area}
                      </td>
                      <td className="py-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          u.trust_score >= 90 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : u.trust_score >= 80 
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {u.trust_score}% Trust
                        </span>
                      </td>
                      <td className="py-3 text-right font-extrabold font-mono text-indigo-400">
                        {u.points} pts
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-4 border-t border-white/10 pt-3">
          <Info className="w-3.5 h-3.5 text-indigo-400" />
          <span>Trust scores weigh your validation votes. High validations accuracy with consistency increases validation multipliers.</span>
        </div>
      </div>

    </div>
  );
}
