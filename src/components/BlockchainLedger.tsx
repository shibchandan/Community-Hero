/**
 * BlockchainLedger Component
 * Displays the public, immutable ledger of all resolved civic issues.
 * Shows SHA-256 content hashes, chain linkage, and simulated Polygon txn IDs.
 * Adds interactive Playgrounds to tamper, mine, and repair the blockchain in real-time.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, CheckCircle, Link as LinkIcon, Hash, Copy, Check, RefreshCw, 
  ShieldCheck, AlertCircle, Cpu, Hammer, Trash2, HelpCircle, AlertTriangle, Terminal, Play
} from 'lucide-react';
import type { LedgerRecord } from '../types';

interface Props {
  theme: 'dark' | 'light';
}

const CATEGORY_COLOR: Record<string, string> = {
  road: 'text-orange-400',
  garbage: 'text-green-400',
  water: 'text-blue-400',
  streetlight: 'text-yellow-400',
  safety: 'text-red-400',
};

export function BlockchainLedger({ theme }: Props) {
  const [records, setRecords] = useState<LedgerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [integrity, setIntegrity] = useState<{ valid: boolean; errorAt?: number; reason?: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Playgound states
  const [activeTab, setActiveTab] = useState<'blocks' | 'playground'>('blocks');
  const [tamperingId, setTamperingId] = useState<string | null>(null);
  const [tamperValue, setTamperValue] = useState('');
  const [remining, setRemining] = useState(false);
  const [miningNewBlock, setMiningNewBlock] = useState(false);
  
  // Custom Block Creator State
  const [customTitle, setCustomTitle] = useState('Corrupted Sub-surface Sewer Line Replaced');
  const [customCategory, setCustomCategory] = useState('water');
  const [customResolver, setCustomResolver] = useState('Delhi Jal Board (DJB)');
  const [customLocation, setCustomLocation] = useState('Sector 7, Dwarka, New Delhi');
  
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setConsoleLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-15));
  };

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const [ledgerRes, verifyRes] = await Promise.all([
        fetch('/api/ledger'),
        fetch('/api/ledger/verify'),
      ]);
      if (ledgerRes.ok) setRecords(await ledgerRes.json());
      if (verifyRes.ok) setIntegrity(await verifyRes.json());
    } catch (e) {
      console.error('Failed to fetch ledger:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Simulates tampering with a block's actual storage in the db
  const handleTamper = async (id: string, currentTitle: string) => {
    if (!tamperValue.trim()) return;
    try {
      addLog(`🚨 WARNING: Sending malicious SQL payload to directly overwrite SQL Database record for Block: ${id}...`);
      const res = await fetch('/api/ledger/tamper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, hackedTitle: tamperValue }),
      });
      if (res.ok) {
        addLog(`💥 SUCCESS: Database record modified bypasses typical verification checks. Title updated to "${tamperValue}".`);
        setTamperingId(null);
        setTamperValue('');
        // Refresh to trigger blockchain linkage failure
        const [ledgerRes, verifyRes] = await Promise.all([
          fetch('/api/ledger'),
          fetch('/api/ledger/verify'),
        ]);
        if (ledgerRes.ok) setRecords(await ledgerRes.json());
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          setIntegrity(verifyData);
          if (!verifyData.valid) {
            addLog(`❌ CRYPTOGRAPHIC VERIFICATION FAILURE: Chain integrity broken at Block #${verifyData.errorAt}!`);
          }
        }
      }
    } catch (err) {
      addLog(`❌ Tampering command failed to dispatch: ${err}`);
    }
  };

  // Simulates re-mining the entire chain
  const handleRebuildChain = async () => {
    setRemining(true);
    setConsoleLogs([]);
    addLog('🔧 INITIALIZING CONSENSUS INTEGRITY RECOVERY MODULE...');
    await new Promise(r => setTimeout(r, 600));
    addLog('🛰️ Scanning peer-to-peer ledger network nodes...');
    await new Promise(r => setTimeout(r, 500));
    addLog('📁 Fetching state parameters from genesis block...');
    await new Promise(r => setTimeout(r, 500));
    
    // Simulate mining loop visualization
    for (let i = 0; i < records.length; i++) {
      addLog(`⛏️ Solving cryptopuzzle for Block #${records[i].blockNumber} [Diff Target: 00...]`);
      await new Promise(r => setTimeout(r, Math.random() * 200 + 100));
      addLog(`✨ Solved Block #${records[i].blockNumber}! Linked forward using hash pointer.`);
    }

    try {
      const res = await fetch('/api/ledger/rebuild', { method: 'POST' });
      if (res.ok) {
        addLog('🔥 Consensus re-established across all validator nodes!');
        addLog('✅ All SHA-256 hash chains successfully synchronized.');
        await fetchLedger();
      }
    } catch (err) {
      addLog(`❌ Recovery failed: ${err}`);
    } finally {
      setRemining(false);
    }
  };

  // Simulates mining a custom block
  const handleMineCustomBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) return;

    setMiningNewBlock(true);
    setConsoleLogs([]);
    addLog(`🏭 COMPILING TRANSACTION PAYLOAD FOR BLOCKHEIGHT #${records.length + 1}...`);
    await new Promise(r => setTimeout(r, 600));
    addLog(`📝 Canonicalizing document structure: Category: ${customCategory}, Authority: ${customResolver}`);
    await new Promise(r => setTimeout(r, 500));
    addLog(`⚡ Starting CPU/GPU Miner Engine. Target constraint: Hash must begin with "00"...`);
    await new Promise(r => setTimeout(r, 400));

    // Dynamic nonce solving display
    const nonces = [12, 108, 482, 1205, 3814, 5493];
    for (let nonce of nonces) {
      addLog(`⏳ Guessing Nonce: ${nonce} -> Hash: f7a2c...`);
      await new Promise(r => setTimeout(r, 150));
    }

    try {
      const res = await fetch('/api/ledger/mine-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: customTitle.trim(),
          category: customCategory,
          resolvedBy: customResolver.trim(),
          location: customLocation.trim()
        }),
      });

      if (res.ok) {
        const block = await res.json();
        addLog(`🎉 SUCCESS! Solved cryptographic challenge with Nonce ${block.nonce}!`);
        addLog(`📦 Block successfully recorded on Polygon Testnet. Tx: ${block.txSimulated.slice(0, 16)}...`);
        setCustomTitle('');
        await fetchLedger();
      }
    } catch (err) {
      addLog(`❌ Mining failure: ${err}`);
    } finally {
      setMiningNewBlock(false);
    }
  };

  const card = theme === 'dark'
    ? 'bg-slate-900/60 border-slate-800 hover:bg-slate-900/90'
    : 'bg-white border-slate-200 hover:bg-slate-50';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`text-xl font-black font-display flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <Shield className="w-5 h-5 text-indigo-500 animate-pulse" />
            Civic Proof Ledger Explorer
          </h2>
          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            Cryptographically secured SHA-256 chain linkage for local municipal decisions & resolutions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Chain Integrity Badge */}
          {integrity && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
              integrity.valid
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-bounce'
            }`}>
              {integrity.valid
                ? <><ShieldCheck className="w-3.5 h-3.5" /> Chain Integrity Verified</>
                : <><AlertCircle className="w-3.5 h-3.5" /> Database Tamper Detected!</>
              }
            </div>
          )}
          <button
            onClick={fetchLedger}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              theme === 'dark' ? 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('blocks')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'blocks'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          ⛓️ Block Explorer ({records.length})
        </button>
        <button
          onClick={() => setActiveTab('playground')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'playground'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          🧪 Dynamic Ledger Lab {!integrity?.valid && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />}
        </button>
      </div>

      {activeTab === 'playground' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Mining Station */}
          <div className="lg:col-span-7 space-y-6">
            <div className={`p-5 rounded-xl border ${card}`}>
              <h3 className={`text-sm font-extrabold mb-3 flex items-center gap-1.5 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                <Hammer className="w-4 h-4 text-amber-400" />
                Public Block Mining Station
              </h3>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Manually record a new resolved municipal asset by mining a new cryptographically certified block. 
                This solves a <strong>Proof-of-Work (PoW) puzzle</strong> in real-time, verifying compliance.
              </p>

              <form onSubmit={handleMineCustomBlock} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Issue Title / Action</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Broken water conduit repaired"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      className={`w-full text-xs px-3 py-2 rounded-lg border focus:ring-2 focus:ring-indigo-500/50 focus:outline-none ${
                        theme === 'dark' ? 'border-white/10 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Location Details</label>
                    <input
                      type="text"
                      required
                      value={customLocation}
                      onChange={(e) => setCustomLocation(e.target.value)}
                      className={`w-full text-xs px-3 py-2 rounded-lg border focus:ring-2 focus:ring-indigo-500/50 focus:outline-none ${
                        theme === 'dark' ? 'border-white/10 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Category Route</label>
                    <select
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className={`w-full text-xs px-3 py-2 rounded-lg border focus:ring-2 focus:ring-indigo-500/50 focus:outline-none ${
                        theme === 'dark' ? 'border-white/10 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900'
                      }`}
                    >
                      <option value="road">Road Maintenance</option>
                      <option value="garbage">Garbage Management</option>
                      <option value="water">Water Utility</option>
                      <option value="streetlight">Public Streetlights</option>
                      <option value="safety">Neighborhood Safety</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Inspecting Authority</label>
                    <input
                      type="text"
                      required
                      value={customResolver}
                      onChange={(e) => setCustomResolver(e.target.value)}
                      className={`w-full text-xs px-3 py-2 rounded-lg border focus:ring-2 focus:ring-indigo-500/50 focus:outline-none ${
                        theme === 'dark' ? 'border-white/10 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={miningNewBlock || remining}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    (miningNewBlock || remining) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Play className="w-3.5 h-3.5" />
                  {miningNewBlock ? 'Solving Cryptographic Puzzle...' : 'Launch GPU Miner Engine'}
                </button>
              </form>
            </div>

            {/* Block Repair Station */}
            <div className={`p-5 rounded-xl border ${
              integrity?.valid 
                ? 'border-slate-800 bg-slate-900/30' 
                : 'border-rose-900/50 bg-rose-950/20 animate-pulse'
            }`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${integrity?.valid ? 'text-slate-500' : 'text-rose-400'}`} />
                <div>
                  <h4 className={`text-sm font-extrabold mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {integrity?.valid ? 'Chain Status: Healthy & Synced' : '⚠️ Critical: Hash Chain Desynchronization detected!'}
                  </h4>
                  <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                    {integrity?.valid 
                      ? 'No tampering detected. Every block aligns perfectly with its successor using SHA-256 forward-link pointers.'
                      : integrity.reason || `Unauthorized modifications broke the ledger. Block #${integrity.errorAt} is disconnected.`}
                  </p>
                  
                  {!integrity?.valid && (
                    <button
                      onClick={handleRebuildChain}
                      disabled={remining || miningNewBlock}
                      className={`px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 flex items-center gap-2 transition-all cursor-pointer ${
                        remining ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    >
                      <Hammer className={`w-3.5 h-3.5 ${remining ? 'animate-spin' : ''}`} />
                      Re-Mine Ledger & Restore Consensus
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Node Terminal Logs */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-black/80 rounded-xl border border-slate-800 p-4 font-mono text-[11px] leading-relaxed text-indigo-400 shadow-2xl h-[380px] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-2 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                <span className="flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5 text-indigo-500" /> Miner Node Console Logs</span>
                <span className="text-emerald-500">● Live Node</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin">
                {consoleLogs.length === 0 ? (
                  <p className="text-slate-500 italic py-8 text-center">[Node idle. Perform a database tamper or mine a custom block to stream terminal transactions...]</p>
                ) : (
                  consoleLogs.map((log, index) => (
                    <div key={index} className="transition-all duration-150">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'blocks' && (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Verified Blocks', value: records.length, icon: Hash, color: 'text-purple-400' },
              { label: 'Blockchain Network', value: 'Polygon Testnet', icon: Cpu, color: 'text-indigo-400' },
              { label: 'Encryption Standard', value: 'SHA-256 Link', icon: Shield, color: 'text-cyan-400' },
              { label: 'Validator Consensus', value: integrity?.valid ? 'ACTIVE' : 'FAILING', icon: CheckCircle, color: integrity?.valid ? 'text-emerald-400' : 'text-rose-400' },
            ].map(stat => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className={`p-4 rounded-xl border ${card} transition-all`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{stat.label}</span>
                  </div>
                  <p className={`text-xl font-black font-mono ${stat.color}`}>{stat.value}</p>
                </div>
              );
            })}
          </div>

          {/* Records list */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
          ) : records.length === 0 ? (
            <div className={`text-center py-16 rounded-2xl border ${theme === 'dark' ? 'border-white/10 bg-white/3' : 'border-slate-200 bg-slate-50'}`}>
              <Shield className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-40" />
              <p className={`font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>No records yet</p>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                Resolve a civic issue to generate the first blockchain record, or use the Dynamic Ledger Lab to mine one!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {[...records].reverse().map((record, i) => (
                  <motion.div
                    key={record.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`rounded-xl border transition-all cursor-pointer overflow-hidden ${card} ${
                      !integrity?.valid && integrity.errorAt === record.blockNumber
                        ? 'border-rose-500/50 bg-rose-950/5 hover:bg-rose-950/10'
                        : ''
                    }`}
                    onClick={() => setExpanded(expanded === record.id ? null : record.id)}
                  >
                    {/* Summary Row */}
                    <div className="flex items-center gap-3 p-4">
                      {/* Block Number */}
                      <div className="shrink-0 w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <span className="text-xs font-black text-indigo-400">#{record.blockNumber}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            {record.issueTitle}
                          </p>
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${CATEGORY_COLOR[record.category] || 'text-slate-400'} bg-current/10`}>
                            {record.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className={`text-[10px] font-mono truncate ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            {record.contentHash.slice(0, 16)}…{record.contentHash.slice(-8)}
                          </span>
                          <span className={`text-[9px] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                            {new Date(record.resolvedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <LinkIcon className="w-3.5 h-3.5 text-indigo-400" />
                        {(!integrity?.valid && record.blockNumber >= integrity.errorAt!) ? (
                          <AlertCircle className="w-4 h-4 text-rose-500" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    <AnimatePresence>
                      {expanded === record.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className={`border-t px-4 pb-4 pt-3 space-y-3 ${theme === 'dark' ? 'border-white/10' : 'border-slate-100'}`}>
                            {[
                              { label: 'Content Hash (SHA-256)', value: record.contentHash, id: 'hash-' + record.id },
                              { label: 'Previous Block Hash', value: record.previousHash, id: 'prev-' + record.id },
                              { label: 'Polygon TX ID', value: record.txSimulated, id: 'tx-' + record.id },
                            ].map(field => (
                              <div key={field.label}>
                                <p className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                                  {field.label}
                                </p>
                                <div className={`flex items-center gap-2 p-2 rounded-lg font-mono text-[10px] break-all ${
                                  theme === 'dark' ? 'bg-black/30 text-green-400' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  <span className="flex-1">{field.value}</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(field.value, field.id); }}
                                    className="shrink-0 p-1 rounded hover:bg-white/10 transition-all cursor-pointer"
                                    title="Copy"
                                  >
                                    {copiedId === field.id
                                      ? <Check className="w-3 h-3 text-emerald-400" />
                                      : <Copy className="w-3 h-3 text-slate-400" />
                                    }
                                  </button>
                                </div>
                              </div>
                            ))}

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                              {[
                                { label: 'Inspecting Authority', value: record.resolvedBy },
                                { label: 'PoW Nonce (CPU Complexity)', value: record.nonce.toLocaleString() },
                                { label: 'Settlement Status', value: 'Polygon Finalized' },
                              ].map(f => (
                                <div key={f.label} className={`p-2 rounded-lg text-center ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}`}>
                                  <p className={`text-[9px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{f.label}</p>
                                  <p className={`text-xs font-bold mt-0.5 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{f.value}</p>
                                </div>
                              ))}
                            </div>

                            {/* Tampering Simulation Station inside expanded view */}
                            <div className={`p-3 rounded-lg border border-dashed mt-2 ${
                              theme === 'dark' ? 'border-white/10 bg-black/10' : 'border-slate-300 bg-slate-50'
                            }`} onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">🔒 Block Security Sandbox</p>
                                  <p className="text-[10px] text-gray-500 mt-0.5">Overrule this database record directly to see the chain detect intrusion.</p>
                                </div>
                                {tamperingId !== record.id ? (
                                  <button
                                    onClick={() => { setTamperingId(record.id); setTamperValue(record.issueTitle); }}
                                    className="px-2.5 py-1 text-[9px] font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-md transition-all cursor-pointer"
                                  >
                                    Inject SQL Tampering
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setTamperingId(null)}
                                    className="px-2 py-0.5 text-[9px] text-gray-400 hover:text-white"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>

                              {tamperingId === record.id && (
                                <div className="mt-3 flex gap-2">
                                  <input
                                    type="text"
                                    value={tamperValue}
                                    onChange={(e) => setTamperValue(e.target.value)}
                                    className={`flex-1 text-xs px-2.5 py-1 rounded-md border focus:outline-none ${
                                      theme === 'dark' ? 'border-white/10 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-900'
                                    }`}
                                  />
                                  <button
                                    onClick={() => handleTamper(record.id, record.issueTitle)}
                                    className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] rounded-md transition-all cursor-pointer flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3 h-3" /> Execute Injection
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  );
}
