import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
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
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Executive Verdict Banner */}
      <div className="rounded-2xl bg-white dark:bg-workspace-900 p-6 sm:p-8 border border-slate-200/90 dark:border-workspace-700/80 shadow-sm relative overflow-hidden space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono uppercase tracking-widest text-cyan-700 dark:text-brand-cyan font-bold bg-cyan-50 dark:bg-brand-cyan/15 px-2 py-0.5 rounded border border-cyan-200 dark:border-brand-cyan/30">
                Deterministic Audit Dossier
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {mission?.title || 'Mission Verification Dossier'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              {latestRun?.summary || 'Independent verification rules evaluated against cryptographic snapshot records.'}
            </p>
          </div>

          {/* Large Verdict Badge */}
          <div className="flex flex-col items-start md:items-end">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">Final Audit Verdict</span>
            <div
              className={`px-6 py-2.5 rounded-xl border-2 font-mono font-black text-xl tracking-wider uppercase shadow-xs flex items-center gap-2 ${
                verdict === 'PASS'
                  ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-400 dark:border-emerald-500/50'
                  : verdict === 'FAIL'
                  ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-400 dark:border-rose-500/50'
                  : 'bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-400 dark:border-amber-500/50'
              }`}
            >
              {verdict === 'PASS' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              ) : verdict === 'FAIL' ? (
                <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              )}
              <span>{verdict}</span>
            </div>
          </div>
        </div>

        {/* Breakdown Metric Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-workspace-750">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-workspace-900/80 border border-slate-200/80 dark:border-workspace-700/70">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Passed Checks</span>
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              {latestRun?.passCount ?? 0}
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-workspace-900/80 border border-slate-200/80 dark:border-workspace-700/70">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Failed Checks</span>
            <span className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5 block">
              {latestRun?.failCount ?? 0}
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-workspace-900/80 border border-slate-200/80 dark:border-workspace-700/70">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Uncertain Checks</span>
            <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5 block">
              {latestRun?.uncertainCount ?? 0}
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-workspace-900/80 border border-slate-200/80 dark:border-workspace-700/70">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Total Evaluated</span>
            <span className="text-2xl font-bold font-mono text-slate-800 dark:text-white mt-0.5 block">
              {latestRun?.totalChecks ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Generated Artifacts Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-600 dark:text-brand-cyan" />
            <span>Deliverable Artifacts (Disk Readback Validated)</span>
          </h2>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-workspace-800 px-2.5 py-1 rounded">
            {artifacts.length} files compiled
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {artifacts.map((art) => {
            return (
              <div
                key={art.id}
                className="rounded-2xl bg-white dark:bg-workspace-900 p-5 border border-slate-200/90 dark:border-workspace-700/80 hover:border-slate-300 dark:hover:border-slate-500 shadow-sm space-y-3 flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-100 dark:bg-workspace-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-workspace-700">
                      {art.artifactType} (v{art.version})
                    </span>
                    {art.isValidated && (
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.2 rounded">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Validated
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate" title={art.filename}>
                    {art.filename}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-1">
                    {(art.sizeBytes / 1024).toFixed(1)} KB • Hash: {art.hash.slice(0, 8)}...
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-workspace-750">
                  <a
                    href={`/api/v1/missions/${missionId}/artifacts/${art.id}/download`}
                    download={art.filename}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-workspace-800 dark:hover:bg-workspace-750 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-workspace-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-600 dark:text-brand-cyan" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deterministic Verification Checks Table */}
      <div className="rounded-2xl bg-white dark:bg-workspace-900 border border-slate-200/90 dark:border-workspace-700/80 shadow-sm overflow-hidden space-y-0">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-workspace-700 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-600 dark:text-brand-cyan" />
              <span>Independent Verification Rule Suite</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Rule-by-rule evaluation results independent of the language model</p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-workspace-800 px-2 py-0.5 rounded">
            {checks.length} assertions
          </span>
        </div>

        <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-workspace-900/90 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-workspace-700 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3">Rule ID</th>
                <th className="px-6 py-3">Check Description</th>
                <th className="px-6 py-3">Result</th>
                <th className="px-6 py-3">Audit Reason</th>
                <th className="px-6 py-3">Expected vs Actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-workspace-700/60 text-slate-700 dark:text-slate-300">
              {checks.map((chk) => (
                <tr key={chk.id} className="hover:bg-slate-50/80 dark:hover:bg-workspace-800/40 transition-colors">
                  <td className="px-6 py-3.5 font-mono font-bold text-slate-800 dark:text-slate-300">
                    {chk.ruleId}
                  </td>
                  <td className="px-6 py-3.5 font-medium text-slate-900 dark:text-slate-200">
                    {chk.name}
                  </td>
                  <td className="px-6 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                        chk.status === 'PASS'
                          ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                          : chk.status === 'FAIL'
                          ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                          : 'bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                      }`}
                    >
                      {chk.status}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300 max-w-sm leading-relaxed">
                    {chk.reason}
                    {chk.remediation && (
                      <span className="block text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                        Remediation: {chk.remediation}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    <div>Exp: {chk.expectedValue || '—'}</div>
                    <div className="text-slate-800 dark:text-slate-300 font-semibold">Act: {chk.actualValue || '—'}</div>
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
