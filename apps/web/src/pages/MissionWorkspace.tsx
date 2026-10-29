import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Compass,
  Play,
  Sparkles,
  Shield,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  GitBranch,
  RotateCw
} from 'lucide-react';
import { api } from '../api/client.js';
import type { AutonomyPolicyLevel } from '@parallax/shared';

const MISSION_PRESETS = [
  {
    title: '5 Student AI Tools (Signature Demo)',
    prompt: 'Research five AI tools useful for university students. Compare their features, pricing, free plans, and official URLs. Capture supporting quotations from reliable sources, generate a CSV and a detailed report, verify every claim against its evidence, and tell me if any source information changes later.',
    badge: 'Signature',
    autonomy: 'INTERACTIVE_NAVIGATION' as AutonomyPolicyLevel
  },
  {
    title: 'SaaS Competitor Pricing Matrix',
    prompt: 'Audit and compare pricing tiers, billing cycles, and feature quotas across top SaaS collaboration software. Extract exact quotes and audit contradictory tier claims.',
    badge: 'Standard',
    autonomy: 'READ_ONLY_RESEARCH' as AutonomyPolicyLevel
  },
  {
    title: 'Academic Citation Software Audit',
    prompt: 'Evaluate citation managers and bibliography tools for university researchers. Verify pricing, student discounts, and format compliance against official portal documentation.',
    badge: 'Standard',
    autonomy: 'INTERACTIVE_NAVIGATION' as AutonomyPolicyLevel
  }
];

export function MissionWorkspace() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [prompt, setPrompt] = useState(MISSION_PRESETS[0].prompt);
  const [autonomyLevel, setAutonomyLevel] = useState<AutonomyPolicyLevel>('INTERACTIVE_NAVIGATION');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch missions history
  const { data: missionsData, isLoading: isLoadingMissions } = useQuery({
    queryKey: ['missions'],
    queryFn: () => api.listMissions()
  });

  const missions = missionsData?.missions || [];

  // Create mission mutation
  const createMutation = useMutation({
    mutationFn: (data: { prompt: string; autonomyLevel: AutonomyPolicyLevel }) => api.createMission(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      // Immediately initiate execution
      api.startMission(data.mission.id).then(() => {
        navigate(`/missions/${data.mission.id}/live`);
      }).catch(() => {
        navigate(`/missions/${data.mission.id}/live`);
      });
    },
    onError: (err: any) => {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Failed to initialize mission');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    createMutation.mutate({ prompt, autonomyLevel });
  };

  return (
    <div className="space-y-10">
      {/* Hero & Tagline */}
      <div className="relative overflow-hidden rounded-2xl glass-panel p-8 sm:p-10 border border-workspace-700/80 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-brand-cyan/10 to-brand-indigo/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-cyan/15 border border-brand-cyan/30 text-brand-cyan text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Verifiable Browser Execution</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            From browser execution to <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-cyan to-indigo-400">evidence-backed outcomes</span>.
          </h1>

          <p className="mt-3 text-slate-300 text-base leading-relaxed">
            Express complex web research missions in natural language. PARALLAX compiles structured execution DAGs, performs permitted actions in a real browser, anchors claims to exact excerpts, validates outputs deterministically, and detects source drift.
          </p>
        </div>
      </div>

      {/* Mission Creation Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Input Form */}
        <div className="lg:col-span-2 glass-panel rounded-xl p-6 border border-workspace-700/70 shadow-lg space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-semibold text-lg">
              <Compass className="w-5 h-5 text-brand-cyan" />
              <span>Launch New Mission</span>
            </div>
            <span className="text-xs text-slate-400">Powered by Intent Compiler</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="mission-prompt" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Task Specification (Natural Language)
              </label>
              <textarea
                id="mission-prompt"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your research task, target entities, required fields, and desired verification rules..."
                className="w-full rounded-lg bg-workspace-900 border border-workspace-700 p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-colors"
                required
              />
            </div>

            {/* Presets */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Quick Mission Presets
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {MISSION_PRESETS.map((preset) => (
                  <button
                    key={preset.title}
                    type="button"
                    onClick={() => {
                      setPrompt(preset.prompt);
                      setAutonomyLevel(preset.autonomy);
                    }}
                    className={`text-left p-3 rounded-lg border text-xs transition-all ${
                      prompt === preset.prompt
                        ? 'bg-workspace-750 border-brand-cyan text-white shadow-sm'
                        : 'bg-workspace-850/60 border-workspace-700/70 text-slate-300 hover:border-slate-500 hover:bg-workspace-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-200 truncate">{preset.title}</span>
                      {preset.badge === 'Signature' && (
                        <span className="text-[9px] bg-brand-cyan/20 text-brand-cyan px-1.5 py-0.2 rounded font-mono font-bold">
                          DEMO
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{preset.prompt}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Autonomy Policy Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Autonomy & Sandbox Policy
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'READ_ONLY_RESEARCH', label: 'Read-Only', desc: 'No form fills' },
                    { id: 'INTERACTIVE_NAVIGATION', label: 'Interactive', desc: 'Click & navigate' },
                    { id: 'FORM_INTERACTION', label: 'Form Fill', desc: 'Inputs permitted' },
                    { id: 'HIGH_IMPACT_ACTIONS', label: 'High Impact', desc: 'Approval required' }
                  ] as const
                ).map((level) => (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => setAutonomyLevel(level.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      autonomyLevel === level.id
                        ? 'bg-workspace-750 border-brand-cyan text-white ring-1 ring-brand-cyan'
                        : 'bg-workspace-900 border-workspace-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-semibold text-xs text-slate-200">{level.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{level.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500 font-mono">
                Real Chromium Browser Automation • Deterministic Verification
              </span>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-indigo hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-brand-cyan/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Compiling Plan...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Compile & Execute Mission</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Architectural Principles Card */}
        <div className="glass-panel rounded-xl p-6 border border-workspace-700/70 shadow-lg space-y-5">
          <div className="flex items-center gap-2 text-white font-semibold text-base">
            <Shield className="w-4 h-4 text-brand-cyan" />
            <span>PARALLAX Guarantees</span>
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-workspace-900/80 border border-workspace-700/70 space-y-1">
              <span className="font-semibold text-brand-cyan">1. Evidence Before Confidence</span>
              <p className="text-slate-400">
                A claim is never verified merely because an LLM generated it. Every fact links to exact source quotations, timestamps, and SHA-256 snapshots.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-workspace-900/80 border border-workspace-700/70 space-y-1">
              <span className="font-semibold text-indigo-400">2. Deterministic Verification</span>
              <p className="text-slate-400">
                Rules execute independently of the model. Excerpt exact-matching, currency validity, contradiction audits, and file readback checks.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-workspace-900/80 border border-workspace-700/70 space-y-1">
              <span className="font-semibold text-amber-400">3. Source-Drift & Impact Awareness</span>
              <p className="text-slate-400">
                When a web source updates, the lineage graph identifies precisely which claims, checks, and CSV cells are invalidated.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-workspace-900/80 border border-workspace-700/70 space-y-1">
              <span className="font-semibold text-emerald-400">4. Audit Readback Validation</span>
              <p className="text-slate-400">
                CSV, Markdown, JSON, and HTML deliverables are written to disk and verified through readback parsing before completion.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Missions Table */}
      <div className="glass-panel rounded-xl border border-workspace-700/70 shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-workspace-700/70 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Mission Trajectory Ledger</h2>
            <p className="text-xs text-slate-400">Persistent database-backed mission runs and outcomes</p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {missions.length} mission{missions.length === 1 ? '' : 's'} recorded
          </span>
        </div>

        {isLoadingMissions ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-cyan" />
            <span>Loading mission trajectories...</span>
          </div>
        ) : missions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <Compass className="w-8 h-8 mx-auto mb-3 text-slate-600" />
            <p className="text-slate-300 font-medium">No missions created yet</p>
            <p className="text-xs text-slate-500 mt-1">Select a preset above and click Compile & Execute to start your first verified mission.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-workspace-900/90 text-slate-400 font-semibold border-b border-workspace-700">
                <tr>
                  <th className="px-6 py-3.5">Mission Title</th>
                  <th className="px-6 py-3.5">Execution Status</th>
                  <th className="px-6 py-3.5">Verification Verdict</th>
                  <th className="px-6 py-3.5">Policy Level</th>
                  <th className="px-6 py-3.5">Created At</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-workspace-700/60 text-slate-300">
                {missions.map((m) => {
                  const isCompleted = m.status === 'completed';
                  const isRunning = m.status === 'running';

                  return (
                    <tr key={m.id} className="hover:bg-workspace-800/40 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-200">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-white">{m.title}</span>
                          <span className="text-[11px] text-slate-400 line-clamp-1 max-w-md font-mono">{m.rawPrompt}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase ${
                          isRunning
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse'
                            : isCompleted
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : m.status === 'failed'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-slate-700/40 text-slate-300 border border-slate-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isRunning ? 'bg-cyan-400' : isCompleted ? 'bg-emerald-400' : 'bg-slate-400'
                          }`} />
                          {m.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {m.verdict ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold font-mono uppercase ${
                            m.verdict === 'PASS'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                              : m.verdict === 'FAIL'
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/40'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
                          }`}>
                            {m.verdict === 'PASS' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {m.verdict}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Unevaluated</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] text-slate-400">
                        {m.autonomyLevel}
                      </td>
                      <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">
                        {new Date(m.createdAt).toLocaleDateString()} {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/missions/${m.id}/live`)}
                            className="p-1.5 rounded-md hover:bg-workspace-700 text-slate-300 hover:text-white text-xs flex items-center gap-1 font-medium transition-colors"
                            title="Open Live Execution View"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Execution</span>
                          </button>
                          <button
                            onClick={() => navigate(`/missions/${m.id}/lineage`)}
                            className="p-1.5 rounded-md hover:bg-workspace-700 text-brand-cyan hover:text-cyan-300 text-xs flex items-center gap-1 font-medium transition-colors"
                            title="Inspect Lineage Graph"
                          >
                            <GitBranch className="w-3.5 h-3.5" />
                            <span>Lineage</span>
                          </button>
                          <button
                            onClick={() => navigate(`/missions/${m.id}/report`)}
                            className="p-1.5 rounded-md hover:bg-workspace-700 text-indigo-300 hover:text-indigo-200 text-xs flex items-center gap-1 font-medium transition-colors"
                            title="View Verification Report"
                          >
                            <FileCheck2 className="w-3.5 h-3.5" />
                            <span>Report</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
