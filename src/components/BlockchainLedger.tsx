/**
 * BlockchainLedger Component
 * Displays the public, immutable ledger of all resolved civic issues.
 * Shows SHA-256 content hashes, chain linkage, and simulated Polygon txn IDs.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, CheckCircle, Link, Hash, Copy, Check, RefreshCw, ShieldCheck, AlertCircle, Cpu } from 'lucide-react';
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
  const [integrity, setIntegrity] = useState<{ valid: boolean; errorAt?: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const [ledgerRes, verifyRes] = await Promise.all([
        fetch('/api/ledger'),
        fetch('/api/ledger/verify'),
      ]);
      if (ledgerRes.ok) setRecords(await ledgerRes.json());
      if (verifyRes.ok) setIntegrity(await verifyRes.json());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLedger(); }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const card = theme === 'dark'
    ? 'bg-white/4 border-white/10 hover:bg-white/7'
    : 'bg-white border-slate-200 hover:bg-slate-50';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`text-xl font-black font-display flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <Shield className="w-5 h-5 text-purple-400" />
            Blockchain Verification Ledger
          </h2>
          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            Cryptographically secured SHA-256 proof hashes for every resolved civic issue · Polygon Testnet
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Chain Integrity Badge */}
          {integrity && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
              integrity.valid
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {integrity.valid
                ? <><ShieldCheck className="w-3.5 h-3.5" /> Chain Intact</>
                : <><AlertCircle className="w-3.5 h-3.5" /> Tamper Detected at Block #{integrity.errorAt}</>
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

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Records', value: records.length, icon: Hash, color: 'text-purple-400' },
          { label: 'Network', value: 'Polygon', icon: Cpu, color: 'text-indigo-400' },
          { label: 'Algorithm', value: 'SHA-256', icon: Shield, color: 'text-cyan-400' },
          { label: 'Chain Status', value: integrity?.valid ? 'Verified' : records.length === 0 ? 'Empty' : 'Error', icon: CheckCircle, color: integrity?.valid ? 'text-emerald-400' : 'text-amber-400' },
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

      {/* Records */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <div className={`text-center py-16 rounded-2xl border ${theme === 'dark' ? 'border-white/10 bg-white/3' : 'border-slate-200 bg-slate-50'}`}>
          <Shield className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-40" />
          <p className={`font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>No records yet</p>
          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
            Resolve a civic issue to generate the first blockchain record
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
                className={`rounded-xl border transition-all cursor-pointer ${card}`}
                onClick={() => setExpanded(expanded === record.id ? null : record.id)}
              >
                {/* Summary Row */}
                <div className="flex items-center gap-3 p-4">
                  {/* Block Number */}
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <span className="text-xs font-black text-purple-400">#{record.blockNumber}</span>
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
                    <Link className="w-3.5 h-3.5 text-purple-400" />
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
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
                          { label: 'Simulated Tx ID', value: record.txSimulated, id: 'tx-' + record.id },
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
                            { label: 'Resolved By', value: record.resolvedBy },
                            { label: 'Nonce (PoW)', value: record.nonce.toLocaleString() },
                            { label: 'Network', value: record.network },
                          ].map(f => (
                            <div key={f.label} className={`p-2 rounded-lg text-center ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}`}>
                              <p className={`text-[9px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{f.label}</p>
                              <p className={`text-xs font-bold mt-0.5 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{f.value}</p>
                            </div>
                          ))}
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
    </div>
  );
}
