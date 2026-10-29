import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Download,
  FileText,
  ShieldCheck
} from 'lucide-react';
import { api } from '../api/client.js';
import type { Artifact, VerificationCheck, VerificationRun } from '@parallax/shared';

export function VerificationReport() {
  const { id: missionId } = useParams<{ id: string }>();

  // Fetch Verification Data
  const { data: verifData } = useQuery({
    queryKey: ['verification', missionId],
    queryFn: () => (missionId ? api.getVerification(missionId) : null),
    enabled: !!missionId
  });

  // Fetch Artifacts
  const { data: artifactsData } = useQuery({
    queryKey: ['artifacts', missionId],
    queryFn: () => (missionId ? api.getArtifacts(missionId) : null),
    enabled: !!missionId
  });

  // Fetch Mission
  const { data: missionData } = useQuery({
    queryKey: ['mission', missionId],
    queryFn: () => (missionId ? api.getMission(missionId) : null),
    enabled: !!missionId
  });

  const latestRun: VerificationRun | undefined = verifData?.runs?.[0];
  const checks: VerificationCheck[] = verifData?.latestChecks || [];
  const artifacts: Artifact[] = artifactsData?.artifacts || [];
  const mission = missionData?.mission;

  const verdict = latestRun?.verdict || mission?.verdict || 'UNCERTAIN';

  return (
    <div className="space-y-8">
      {/* Executive Verdict Banner */}
      <div className="glass-panel rounded-2xl p-8 border border-workspace-700/80 shadow-2xl relative overflow-hidden space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono uppercase tracking-widest text-brand-cyan font-bold">
                Deterministic Audit Report
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              {mission?.title || 'Mission Verification Dossier'}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {latestRun?.summary || 'Independent verification rules evaluated against cryptographic snapshot records.'}
            </p>
          </div>

          {/* Large Verdict Badge */}
          <div className="flex flex-col items-end">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">Audit Verdict</span>
            <div
              className={`px-6 py-2.5 rounded-xl border-2 font-mono font-black text-xl tracking-wider uppercase shadow-xl flex items-center gap-2 ${
                verdict === 'PASS'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-500/10'
                  : verdict === 'FAIL'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-rose-500/10'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-500/10'
              }`}
            >
              {verdict === 'PASS' && <CheckCircle2 className="w-6 h-6 text-emerald-400" />}
              <span>{verdict}</span>
            </div>
          </div>
        </div>

        {/* Breakdown Metric Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-workspace-750">
          <div className="p-3 rounded-lg bg-workspace-900/80 border border-workspace-700/70">
            <span className="text-[11px] text-slate-400 block font-medium">Passed Checks</span>
            <span className="text-2xl font-bold font-mono text-emerald-400 mt-0.5 block">
              {latestRun?.passCount ?? 0}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-workspace-900/80 border border-workspace-700/70">
            <span className="text-[11px] text-slate-400 block font-medium">Failed Checks</span>
            <span className="text-2xl font-bold font-mono text-rose-400 mt-0.5 block">
              {latestRun?.failCount ?? 0}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-workspace-900/80 border border-workspace-700/70">
            <span className="text-[11px] text-slate-400 block font-medium">Uncertain Checks</span>
            <span className="text-2xl font-bold font-mono text-amber-400 mt-0.5 block">
              {latestRun?.uncertainCount ?? 0}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-workspace-900/80 border border-workspace-700/70">
            <span className="text-[11px] text-slate-400 block font-medium">Total Evaluated</span>
            <span className="text-2xl font-bold font-mono text-white mt-0.5 block">
              {latestRun?.totalChecks ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Generated Artifacts Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-cyan" />
            <span>Deliverable Artifacts (Disk Readback Validated)</span>
          </h2>
          <span className="text-xs font-mono text-slate-400">{artifacts.length} files compiled</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {artifacts.map((art) => {
            return (
              <div
                key={art.id}
                className="glass-panel rounded-xl p-5 border border-workspace-700/80 hover:border-slate-500 shadow-md space-y-3 flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-workspace-800 text-slate-300 border border-workspace-700">
                      {art.artifactType} (v{art.version})
                    </span>
                    {art.isValidated && (
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Validated
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs font-bold text-white truncate" title={art.filename}>
                    {art.filename}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-1">
                    {(art.sizeBytes / 1024).toFixed(1)} KB • Hash: {art.hash.slice(0, 8)}...
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-workspace-750">
                  <a
                    href={`/api/v1/missions/${missionId}/artifacts/${art.id}/download`}
                    download={art.filename}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-workspace-800 hover:bg-workspace-750 text-slate-200 hover:text-white border border-workspace-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-brand-cyan" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deterministic Verification Checks Table */}
      <div className="glass-panel rounded-xl border border-workspace-700/80 shadow-xl overflow-hidden space-y-0">
        <div className="px-6 py-4 border-b border-workspace-700 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-cyan" />
              <span>Independent Verification Rule Suite</span>
            </h2>
            <p className="text-xs text-slate-400">Rule-by-rule evaluation results independent of the language model</p>
          </div>
          <span className="text-xs font-mono text-slate-400">{checks.length} assertions</span>
        </div>

        <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-workspace-900/90 text-slate-400 font-semibold border-b border-workspace-700 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3">Rule ID</th>
                <th className="px-6 py-3">Check Description</th>
                <th className="px-6 py-3">Result</th>
                <th className="px-6 py-3">Audit Reason</th>
                <th className="px-6 py-3">Expected vs Actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-workspace-700/60 text-slate-300">
              {checks.map((chk) => (
                <tr key={chk.id} className="hover:bg-workspace-800/40 transition-colors">
                  <td className="px-6 py-3 font-mono font-bold text-slate-300">
                    {chk.ruleId}
                  </td>
                  <td className="px-6 py-3 font-medium text-slate-200">
                    {chk.name}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                        chk.status === 'PASS'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : chk.status === 'FAIL'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {chk.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-300 max-w-sm">
                    {chk.reason}
                    {chk.remediation && (
                      <span className="block text-[10px] text-amber-400/90 mt-0.5">
                        Remediation: {chk.remediation}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 font-mono text-[11px] text-slate-400">
                    <div>Exp: {chk.expectedValue || '—'}</div>
                    <div className="text-slate-300">Act: {chk.actualValue || '—'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
