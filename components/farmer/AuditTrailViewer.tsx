'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  Clock,
  User,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Hash,
  Copy,
  ChevronDown,
  ChevronUp,
  Cpu,
  Lock,
} from 'lucide-react';
import { CryptographicAuditBlock } from '@/lib/types';

interface VerificationResult {
  valid: boolean;
  totalBlocks: number;
  tamperedBlockIndex?: number;
  errorReason?: string;
  latestHash: string;
  algorithm: string;
  verifiedAt: string;
  genesisBlock?: { index: number; hash: string; timestamp: string };
  headBlock?: { index: number; hash: string; timestamp: string };
}

export default function AuditTrailViewer() {
  const [blocks, setBlocks] = useState<CryptographicAuditBlock[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [expandedBlockIndex, setExpandedBlockIndex] = useState<number | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchAuditData = () => {
    setLoading(true);
    fetch('/api/audit')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          // Sort reverse chronologically by blockIndex for display
          const chain: CryptographicAuditBlock[] = data.auditChain || [];
          setBlocks([...chain].sort((a, b) => b.blockIndex - a.blockIndex));
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAuditData();
  }, []);

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const res = await fetch('/api/audit/verify');
      const data = await res.json();
      if (data.success) {
        setVerificationResult(data.verification);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const filteredBlocks = blocks.filter((b) => {
    const matchesSearch =
      b.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.actor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.entityId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.reason?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      b.currentHash.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (typeFilter === 'ALL') return true;
    return b.entityType === typeFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wide flex items-center gap-1">
              <Lock className="w-3 h-3 text-emerald-700" />
              Cryptographic Ledger
            </span>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
              SHA-256 Merkle Chained
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            <span>Cryptographic Delivery Ledger Audit Trail</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Every delivery adjustment, skip, dispute resolution, and payment creates an immutable cryptographic block linking
            <code className="font-mono bg-slate-100 px-1.5 py-0.5 mx-1 rounded text-slate-800">hash_n = SHA256(event + hash_(n-1))</code>.
            Guarantees zero unauthorized tampering or retroactive modifications.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchAuditData}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5 transition cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            id="btn-verify-audit-chain"
            onClick={handleVerifyChain}
            disabled={verifying}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Cpu className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
            <span>{verifying ? 'Re-Computing Hashes...' : 'Verify Cryptographic Integrity'}</span>
          </button>
        </div>
      </div>

      {/* Verification Status Card */}
      {verificationResult && (
        <div
          id="audit-verification-banner"
          className={`p-5 rounded-2xl border transition-all ${
            verificationResult.valid
              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {verificationResult.valid ? (
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              )}
              <div>
                <h4 className="font-extrabold text-sm flex items-center gap-2">
                  <span>{verificationResult.valid ? 'Cryptographic Chain Integrity 100% Verified' : 'Cryptographic Chain Tampering Detected!'}</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/80 border border-current">
                    {verificationResult.totalBlocks} Blocks Verified
                  </span>
                </h4>
                <p className="text-xs mt-1 opacity-90">
                  {verificationResult.valid
                    ? `Every block from Genesis #0 to Head #${verificationResult.totalBlocks - 1} matches mathematical SHA-256 hash chains. No alterations detected.`
                    : `Error: ${verificationResult.errorReason}`}
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] font-mono opacity-80">
                  <span>Algorithm: <strong>{verificationResult.algorithm}</strong></span>
                  <span>Verified at: <strong>{new Date(verificationResult.verifiedAt).toLocaleTimeString()}</strong></span>
                  {verificationResult.headBlock && (
                    <span>
                      Head Hash: <strong className="underline">{verificationResult.headBlock.hash.substring(0, 16)}...</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setVerificationResult(null)}
              className="text-xs opacity-60 hover:opacity-100 font-bold px-2 py-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by action, actor, hash, entity ID, or reason..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'DELIVERY_RECORD', 'INVOICE', 'DISPUTE', 'PAYMENT', 'DAY_CLOSING'].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
                typeFilter === type
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {type === 'ALL' ? 'All Blocks' : type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Cryptographic Blocks Feed */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-xs text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
            Loading cryptographic blocks...
          </div>
        ) : filteredBlocks.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-xs text-slate-500">
            No audit blocks found matching search filter.
          </div>
        ) : (
          filteredBlocks.map((block) => {
            const isExpanded = expandedBlockIndex === block.blockIndex;
            return (
              <div
                key={block.blockIndex}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition hover:border-slate-300"
              >
                {/* Block Header Summary */}
                <div
                  onClick={() => setExpandedBlockIndex(isExpanded ? null : block.blockIndex)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer hover:bg-slate-50/70 transition"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-mono font-extrabold px-2.5 py-0.5 rounded-md bg-slate-900 text-emerald-400">
                        #{block.blockIndex}
                      </span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wide">
                        {block.entityType}
                      </span>
                      <span className="font-bold text-slate-900 text-xs">
                        {block.action}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Target: {block.entityId}
                      </span>
                    </div>

                    {block.reason && (
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold text-slate-700">Reason:</span> &ldquo;{block.reason}&rdquo;
                      </p>
                    )}

                    {/* Hashes preview */}
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono text-slate-500">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Prev Hash:</span>
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                          {block.previousHash.substring(0, 10)}...
                        </span>
                      </div>
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Block Hash:</span>
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                          {block.currentHash.substring(0, 12)}...
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <div className="text-xs font-semibold text-slate-800 flex items-center sm:justify-end gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{block.actor.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({block.actor.role})</span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center sm:justify-end gap-1 mt-0.5 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(block.timestamp).toLocaleString()}</span>
                      </div>
                    </div>

                    <button
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      aria-label="Toggle block details"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Block Details */}
                {isExpanded && (
                  <div className="p-5 bg-slate-50/80 border-t border-slate-200 space-y-4 text-xs">
                    {/* Full Hashes with Copy Buttons */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold">
                          <span className="flex items-center gap-1">
                            <Hash className="w-3.5 h-3.5 text-slate-400" />
                            Previous Hash
                          </span>
                          <button
                            onClick={() => copyToClipboard(block.previousHash)}
                            className="text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedHash === block.previousHash ? 'Copied!' : 'Copy'}</span>
                          </button>
                        </div>
                        <p className="font-mono text-[11px] break-all text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                          {block.previousHash}
                        </p>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold">
                          <span className="flex items-center gap-1">
                            <Hash className="w-3.5 h-3.5 text-emerald-600" />
                            Block Hash (SHA-256)
                          </span>
                          <button
                            onClick={() => copyToClipboard(block.currentHash)}
                            className="text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedHash === block.currentHash ? 'Copied!' : 'Copy'}</span>
                          </button>
                        </div>
                        <p className="font-mono text-[11px] break-all text-emerald-800 bg-emerald-50/60 p-2 rounded border border-emerald-200 font-bold">
                          {block.currentHash}
                        </p>
                      </div>
                    </div>

                    {/* Actor Metadata */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="text-slate-400">Actor:</span>{' '}
                        <strong>{block.actor.name}</strong> ({block.actor.userId})
                      </div>
                      <div>
                        <span className="text-slate-400">IP Address:</span>{' '}
                        <code className="font-mono">{block.actor.ipAddress}</code>
                      </div>
                      <div>
                        <span className="text-slate-400">Timestamp:</span>{' '}
                        <code className="font-mono">{block.timestamp}</code>
                      </div>
                    </div>

                    {/* State Diff (Before vs After) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                        <span className="font-bold text-[11px] text-slate-500 uppercase tracking-wide">
                          Before State
                        </span>
                        <pre className="p-2.5 rounded bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-40">
                          {block.beforeState && Object.keys(block.beforeState).length > 0
                            ? JSON.stringify(block.beforeState, null, 2)
                            : '(Genesis / No prior state)'}
                        </pre>
                      </div>

                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                        <span className="font-bold text-[11px] text-emerald-700 uppercase tracking-wide">
                          After State (Current)
                        </span>
                        <pre className="p-2.5 rounded bg-slate-900 text-emerald-300 font-mono text-[11px] overflow-x-auto max-h-40">
                          {JSON.stringify(block.afterState, null, 2)}
                        </pre>
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
