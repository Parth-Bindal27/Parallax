import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Layers,
  Search,
  Filter,
  ExternalLink,
  Quote
} from 'lucide-react';
import { api } from '../api/client.js';
import type { EvidenceRecord } from '@parallax/shared';

export function EvidenceExplorer() {
  const { id: missionId } = useParams<{ id: string }>();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASS' | 'UNCERTAIN' | 'FAIL'>('ALL');
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null);

  const { data: evidenceData, isLoading } = useQuery({
    queryKey: ['evidence', missionId],
    queryFn: () => (missionId ? api.getEvidence(missionId) : null),
    enabled: !!missionId
  });

  const { data: claimsData } = useQuery({
    queryKey: ['claims', missionId],
    queryFn: () => (missionId ? api.getClaims(missionId) : null),
    enabled: !!missionId
  });

  const evidenceList = evidenceData?.evidence || [];
  const claims = claimsData?.claims || [];

  // Filter evidence
  const filtered = evidenceList.filter((ev) => {
    const matchesSearch =
      ev.exactExcerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.pageTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.url.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || ev.validationStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-brand-cyan" />
            <span>Evidence Ledger Explorer</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Audit-grade quotation ledger anchoring every factual claim to verified snapshot DOM locations
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">
            {filtered.length} of {evidenceList.length} records shown
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel rounded-xl p-4 border border-workspace-700/70 shadow-md flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search quotations, page titles, or URLs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-workspace-900 border border-workspace-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-cyan transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400">Status:</span>
          {(['ALL', 'PASS', 'UNCERTAIN', 'FAIL'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                statusFilter === status
                  ? 'bg-brand-cyan text-slate-950 font-bold'
                  : 'bg-workspace-850 text-slate-400 hover:text-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Evidence Records Grid */}
      {isLoading ? (
        <div className="p-16 text-center text-slate-400 text-sm">
          <span>Loading evidence records...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-16 text-center text-slate-500 text-sm glass-panel rounded-xl border border-workspace-700">
          <Layers className="w-10 h-10 mx-auto mb-2 text-slate-600" />
          <p>No evidence records matching the active filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((ev) => {
            const associatedClaims = claims.filter((c) => c.supportingEvidenceIds.includes(ev.id));

            return (
              <div
                key={ev.id}
                onClick={() => setSelectedEvidence(ev)}
                className={`glass-panel rounded-xl p-5 border cursor-pointer transition-all space-y-3 ${
                  selectedEvidence?.id === ev.id
                    ? 'border-brand-cyan ring-1 ring-brand-cyan bg-workspace-800'
                    : 'border-workspace-700/80 hover:border-slate-500 hover:bg-workspace-850/80'
                }`}
              >
                {/* Header: Title and Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Quote className="w-4 h-4 text-brand-cyan flex-shrink-0" />
                    <span className="text-xs font-bold text-white truncate max-w-xs">{ev.pageTitle}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                      ev.validationStatus === 'PASS'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : ev.validationStatus === 'FAIL'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {ev.validationStatus}
                  </span>
                </div>

                {/* Exact Quotation Block */}
                <div className="p-3 rounded-lg bg-workspace-950/80 border border-workspace-800 text-xs text-slate-200 font-mono leading-relaxed">
                  <span className="text-brand-cyan font-bold">"</span>
                  {ev.exactExcerpt}
                  <span className="text-brand-cyan font-bold">"</span>
                </div>

                {/* Context Snippet */}
                <div className="text-[11px] text-slate-400">
                  <span className="text-slate-500 font-medium">Context: </span>
                  <span className="font-mono text-slate-300 truncate block">{ev.surroundingContext}</span>
                </div>

                {/* Associated Claims Pills */}
                {associatedClaims.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Claims:</span>
                    {associatedClaims.map((c) => (
                      <span
                        key={c.id}
                        className="px-2 py-0.5 rounded bg-brand-indigo/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-medium"
                      >
                        {c.subject}: {c.predicate} ({String(c.value)})
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer Metadata */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-workspace-750 font-mono">
                  <span className="truncate max-w-[200px]" title={ev.url}>{ev.url}</span>
                  <span title={ev.contentFingerprint}>Fingerprint: {ev.contentFingerprint.slice(0, 8)}...</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Evidence Detail Modal / Drawer */}
      {selectedEvidence && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl rounded-2xl border border-workspace-600 p-6 shadow-2xl space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-workspace-700 pb-3">
              <div className="flex items-center gap-2">
                <Quote className="w-5 h-5 text-brand-cyan" />
                <h3 className="font-bold text-base text-white">Evidence Record Detail</h3>
              </div>
              <button
                onClick={() => setSelectedEvidence(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-workspace-800 border border-workspace-700 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block mb-1">Exact Supporting Excerpt:</span>
                <div className="p-3 rounded-lg bg-workspace-950 border border-workspace-700 font-mono text-cyan-200">
                  "{selectedEvidence.exactExcerpt}"
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1">Surrounding Context Window:</span>
                <div className="p-3 rounded-lg bg-workspace-900 border border-workspace-700 font-mono text-slate-300">
                  {selectedEvidence.surroundingContext}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Source URL:</span>
                  <a
                    href={selectedEvidence.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-cyan hover:underline flex items-center gap-1 font-mono break-all"
                  >
                    <span>{selectedEvidence.url}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">SHA-256 Fingerprint:</span>
                  <span className="font-mono text-slate-300 break-all">{selectedEvidence.contentFingerprint}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">DOM Locator:</span>
                  <span className="font-mono text-slate-300">
                    {selectedEvidence.locator.selector || `Char offset: ${selectedEvidence.locator.charOffset ?? 'N/A'}`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Retrieval Timestamp:</span>
                  <span className="font-mono text-slate-300">{selectedEvidence.retrievalTimestamp}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
