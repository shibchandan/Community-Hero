/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Issue, IssueStatus } from '../types';
import { 
  ShieldCheck, AlertCircle, Wrench, CheckSquare, FastForward, 
  Sparkles, FileText, Image, CheckCircle2, RefreshCw, Landmark 
} from 'lucide-react';

interface AuthorityControlProps {
  issues: Issue[];
  onUpdateStatus: (issueId: string, status: IssueStatus, notes: string, proofImage?: string) => void;
  onFastForwardTime: (days: number) => void;
  theme?: 'dark' | 'light';
}

// Pre-seeded high quality "repaired/resolved" photo presets
const PROOF_PRESETS = [
  {
    name: 'Asphalt Pothole Sealed',
    url: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=400&q=80',
    notes: 'Hot asphalt emulsion and sand seal finished. Surface checked for weight load.'
  },
  {
    name: 'Pristine Empty Dumpsters',
    url: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=400&q=80',
    notes: 'Sidewalk swept, power washed, and secondary compactor schedule initialized.'
  },
  {
    name: 'Luminaires LED Operational',
    url: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=400&q=80',
    notes: 'Installed long-range smart LED heads and verified main junction power supplies.'
  }
];

export default function AuthorityControl({ issues, onUpdateStatus, onFastForwardTime, theme = 'dark' }: AuthorityControlProps) {
  const [selectedIssueId, setSelectedIssueId] = useState<string>('');
  const [targetStatus, setTargetStatus] = useState<IssueStatus>('assigned');
  const [actionNotes, setActionNotes] = useState('');
  const [proofPresetIdx, setProofPresetIdx] = useState<number | null>(null);
  const [fastForwardDays, setFastForwardDays] = useState<number>(5);
  const [simulationAlert, setSimulationAlert] = useState<string | null>(null);

  const activeIssue = issues.find(i => i.id === selectedIssueId);

  // Issues awaiting action
  const actionableIssues = issues.filter(i => i.status !== 'closed');

  const handleActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssueId) return;

    let proofUrl = undefined;
    if (proofPresetIdx !== null && (targetStatus === 'resolved' || targetStatus === 'closed')) {
      proofUrl = PROOF_PRESETS[proofPresetIdx].url;
    }

    onUpdateStatus(selectedIssueId, targetStatus, actionNotes, proofUrl);
    
    // Reset inputs
    setActionNotes('');
    setProofPresetIdx(null);
    setSimulationAlert(`Issue successfully transitioned to [${targetStatus.toUpperCase()}] status and logged in public records.`);
    setTimeout(() => setSimulationAlert(null), 4000);
  };

  const handleTriggerTimeWarp = () => {
    onFastForwardTime(fastForwardDays);
    setSimulationAlert(`Time warp initiated! System clock advanced by ${fastForwardDays} days. SLA escalation routines successfully analyzed active backlogs.`);
    setTimeout(() => setSimulationAlert(null), 6000);
  };

  return (
    <div className="space-y-6">
      
      {/* Simulation Accelerator Banner (Time Warp) */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-700 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-white/10 glow-purple">
        <div className="space-y-1">
          <h3 className="text-lg font-bold font-display flex items-center gap-2">
            <FastForward className="w-5 h-5 text-yellow-300 animate-pulse" />
            Autonomous SLA Time Accelerator
          </h3>
          <p className="text-xs text-indigo-100 max-w-lg">
            Simulate advancing time to test the autonomous escalation algorithm. Any unresolved issues that exceed their categorical SLA days will be automatically escalated to higher-tier commissions.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center bg-white/15 px-3 py-1.5 rounded-xl border border-white/10 text-xs font-bold">
            <span className="mr-2 text-indigo-200">Warp:</span>
            <input
              type="number"
              value={fastForwardDays}
              onChange={(e) => setFastForwardDays(Math.max(1, Number(e.target.value)))}
              className="w-10 bg-transparent text-white font-mono text-center focus:outline-none"
              min="1"
            />
            <span className="text-indigo-200 ml-1">Days</span>
          </div>

          <button
            onClick={handleTriggerTimeWarp}
            className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-slate-900 text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            Launch Time Warp
          </button>
        </div>
      </div>

      {simulationAlert && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 animate-fadeIn ${
          theme === 'dark' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-indigo-50 border-indigo-200 text-indigo-700'
        }`}>
          <Sparkles className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          {simulationAlert}
        </div>
      )}

      {/* Main Action Form Panel */}
      <div className="p-6 rounded-2xl bento-card shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Landmark className="w-5.5 h-5.5 text-indigo-550 dark:text-indigo-400" />
          <h3 className={`text-base font-bold font-display ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Municipal SLA Dispatch Panel</h3>
        </div>

        <form onSubmit={handleActionSubmit} className="space-y-4">
          
          {/* Issue Selector Dropdown */}
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>Select Open Civic Complaint</label>
            <select
              value={selectedIssueId}
              onChange={(e) => {
                setSelectedIssueId(e.target.value);
                // Pre-populate with next logical step
                const selected = actionableIssues.find(i => i.id === e.target.value);
                if (selected) {
                  if (selected.status === 'ai_verified' || selected.status === 'community_verified') setTargetStatus('assigned');
                  else if (selected.status === 'assigned') setTargetStatus('in_progress');
                  else if (selected.status === 'in_progress') setTargetStatus('resolved');
                }
              }}
              className={`w-full text-xs px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                theme === 'dark' ? 'border-white/10 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-850'
              }`}
              required
            >
              <option value="" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'}>-- Choose active report requiring attention --</option>
              {actionableIssues.map(i => (
                <option key={i.id} value={i.id} className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'}>
                  [{i.status.toUpperCase()}] {i.title} ({i.location.area})
                </option>
              ))}
            </select>
          </div>

          {activeIssue && (
            <div className={`p-4 rounded-xl border text-xs space-y-2.5 animate-fadeIn ${
              theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex justify-between font-bold">
                <span className={theme === 'dark' ? 'text-gray-300' : 'text-slate-700'}>Selected: <span className="text-indigo-600 dark:text-indigo-400">{activeIssue.title}</span></span>
                <span className={theme === 'dark' ? 'text-gray-400 font-mono' : 'text-slate-500 font-mono'}>Current state: <span className="text-amber-600 dark:text-amber-400 uppercase">{activeIssue.status}</span></span>
              </div>
              <p className={theme === 'dark' ? 'text-gray-400' : 'text-slate-600'}>"{activeIssue.description}"</p>
              <div className={`grid grid-cols-2 gap-2 text-[10px] border-t pt-2 font-mono ${
                theme === 'dark' ? 'text-gray-400 border-white/10' : 'text-slate-500 border-slate-200'
              }`}>
                <span>Target SLA: {activeIssue.slaDays} Days</span>
                <span>Coordinates: {activeIssue.location.lat.toFixed(4)}, {activeIssue.location.lng.toFixed(4)}</span>
              </div>
            </div>
          )}

          {/* Workflow Status Action Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>Workflow Transition State</label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as IssueStatus)}
                className={`w-full text-xs px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                  theme === 'dark' ? 'border-white/10 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-850'
                }`}
              >
                <option value="assigned" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'}>Assign Agency Crew</option>
                <option value="in_progress" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'}>Commence On-Site Repairs (In Progress)</option>
                <option value="resolved" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'}>Log Repair Completed (Upload Proof)</option>
                <option value="closed" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'}>Approve Quality Inspection & Close Case</option>
              </select>
            </div>

            <div>
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>Official Service Action Notes</label>
              <input
                type="text"
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="E.g. Dispatched asphalt crew #2. Repairs scheduled under 24h."
                className={`w-full text-xs px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                  theme === 'dark' ? 'border-white/10 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-850'
                }`}
                required
              />
            </div>
          </div>

          {/* Verification Photo Submission (Only visible during Resolved state transition) */}
          {(targetStatus === 'resolved' || targetStatus === 'closed') && (
            <div className={`border-t pt-4 animate-fadeIn ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
              <label className={`block text-xs font-bold uppercase tracking-wider mb-2.5 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
                Attach Official Repair Resolution Evidence Photo
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PROOF_PRESETS.map((preset, idx) => (
                  <div
                    key={preset.name}
                    onClick={() => {
                      setProofPresetIdx(idx);
                      if (!actionNotes) setActionNotes(preset.notes);
                    }}
                    className={`relative aspect-[3/2] rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                      proofPresetIdx === idx
                        ? 'border-emerald-500 ring-4 ring-emerald-500/15'
                        : theme === 'dark'
                          ? 'border-transparent hover:border-white/20'
                          : 'border-transparent hover:border-slate-300'
                    }`}
                  >
                    <img src={preset.url} alt={preset.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 flex items-end p-2">
                      <span className="text-[9px] font-bold text-white uppercase truncate">{preset.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!selectedIssueId}
            className={`w-full py-3 rounded-xl text-sm font-bold text-white shadow-lg transition-all flex items-center justify-center gap-1.5 ${
              selectedIssueId
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/15 cursor-pointer font-bold'
                : theme === 'dark'
                  ? 'bg-slate-900 text-gray-500 border border-white/5 cursor-not-allowed'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
          >
            <ShieldCheck className="w-4.5 h-4.5" />
            Commit Official Dispatch Updates
          </button>
        </form>
      </div>

    </div>
  );
}
