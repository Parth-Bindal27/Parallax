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
  RotateCw,
  Layers,
  FileText,
  Globe
} from 'lucide-react';
import { api } from '../api/client.js';
import type { AutonomyPolicyLevel } from '@parallax/shared';

const MISSION_PRESETS = [
  {
    title: 'Full Multimodal Orchestration (Pillars 1 & 2)',
    prompt: 'Research three competing AI products, compare their published pricing, identify the target audience, generate a marketing image, prepare a launch script, and produce a verified GTM report.',
    badge: 'Full Orchestration',
    autonomy: 'INTERACTIVE_NAVIGATION' as AutonomyPolicyLevel,
    desc: 'Coordinates browser research, DOM verification, graphic image generation, audio synthesis, and GTM kit.'
  },
  {
    title: '5 Student AI Tools (Signature Demo)',
    prompt: 'Research five AI tools useful for university students. Compare their features, pricing, free plans, and official URLs. Capture supporting quotations from reliable sources, generate a CSV and a detailed report, verify every claim against its evidence, and tell me if any source information changes later.',
    badge: 'Signature Demo',
    autonomy: 'INTERACTIVE_NAVIGATION' as AutonomyPolicyLevel,
    desc: 'Audits StudyPilot, ScholarSync, MathBot, CiteAI, and NoteCraft with live drift testing.'
  },
  {
    title: 'SaaS Competitor Pricing Matrix',
    prompt: 'Audit and compare pricing tiers, billing cycles, and feature quotas across top SaaS collaboration software. Extract exact quotes and audit contradictory tier claims.',
    badge: 'Standard',
    autonomy: 'READ_ONLY_RESEARCH' as AutonomyPolicyLevel,
    desc: 'Extracts exact pricing tiers and verifies quote consistency.'
  },
  {
    title: 'Academic Citation Software Audit',
    prompt: 'Evaluate citation managers and bibliography tools for university researchers. Verify pricing, student discounts, and format compliance against official portal documentation.',
    badge: 'Standard',
    autonomy: 'INTERACTIVE_NAVIGATION' as AutonomyPolicyLevel,
    desc: 'Validates university student discounts against live documentation.'
  }
];

export function MissionWorkspace() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [prompt, setPrompt] = useState(MISSION_PRESETS[0].prompt);
  const [liveUrl, setLiveUrl] = useState('');
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
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-50 via-indigo-50/50 to-white dark:from-workspace-900 dark:via-workspace-850 dark:to-workspace-900 p-8 sm:p-10 border border-slate-200/90 dark:border-workspace-700/80 shadow-sm transition-colors">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-cyan-400/10 to-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-100 dark:bg-brand-cyan/15 border border-cyan-200 dark:border-brand-cyan/30 text-cyan-800 dark:text-brand-cyan text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-brand-cyan" />
            <span>Autonomous Web Research & Verification Workstation</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
            Agents report success. <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-indigo-600">PARALLAX proves it.</span>
          </h1>

          <p className="mt-3 text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
            Give PARALLAX any research task. It operates a real headless browser, extracts exact source quotes with cryptographic snapshots, verifies all facts deterministically, and alerts you whenever web sources change.
          </p>

          {/* 3 Simple Steps Flow */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-200/80 dark:border-workspace-750">
            <div className="flex items-start gap-3 p-2.5 rounded-lg bg-white/80 dark:bg-workspace-800/60 border border-slate-200/60 dark:border-workspace-700/60 shadow-xs">
              <div className="w-7 h-7 rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                1
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">Describe Goal</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Natural language task compiled into execution steps</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-lg bg-white/80 dark:bg-workspace-800/60 border border-slate-200/60 dark:border-workspace-700/60 shadow-xs">
              <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                2
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">Real Browser Agent</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Playwright browses web pages & logs DOM evidence</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-2.5 rounded-lg bg-white/80 dark:bg-workspace-800/60 border border-slate-200/60 dark:border-workspace-700/60 shadow-xs">
              <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                3
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">Deterministic Proof</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Claims mathematically proven; source drift alerted</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mission Creation Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Form Input */}
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-workspace-900 p-6 sm:p-7 border border-slate-200/90 dark:border-workspace-700/80 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-workspace-800">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-base">
              <Compass className="w-5 h-5 text-cyan-600 dark:text-brand-cyan" />
              <span>Launch New Mission</span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Instant Plan Compilation
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Presets */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Select a Quick Preset
                </label>
                <span className="text-[11px] text-slate-400">Click to load pre-configured research mission</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {MISSION_PRESETS.map((preset) => {
                  const isSelected = prompt === preset.prompt;
                  return (
                    <button
                      key={preset.title}
                      type="button"
                      onClick={() => {
                        setPrompt(preset.prompt);
                        setAutonomyLevel(preset.autonomy);
                      }}
                      className={`text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/80 dark:bg-workspace-750 border-indigo-400 dark:border-brand-cyan text-slate-900 dark:text-white shadow-xs ring-1 ring-indigo-400 dark:ring-brand-cyan'
                          : 'bg-slate-50 dark:bg-workspace-850/60 border-slate-200 dark:border-workspace-700/70 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-slate-900 dark:text-slate-100 truncate">{preset.title}</span>
                      </div>
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold mb-2 ${
                        preset.badge === 'Signature Demo'
                          ? 'bg-cyan-100 dark:bg-brand-cyan/20 text-cyan-800 dark:text-brand-cyan border border-cyan-200 dark:border-brand-cyan/30'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        {preset.badge}
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {preset.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Direct Live URL Injection */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-workspace-850 border border-slate-200 dark:border-workspace-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Target Any Real-World Website URL</span>
                </label>
                <span className="text-[10px] font-mono text-cyan-700 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-800">
                  Universal Crawler Active
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="e.g. https://news.ycombinator.com or https://github.com/trending"
                  value={liveUrl}
                  onChange={(e) => setLiveUrl(e.target.value)}
                  className="flex-1 rounded-lg bg-white dark:bg-workspace-900 border border-slate-200 dark:border-workspace-700 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!liveUrl.trim()) return;
                    setPrompt(`Browse ${liveUrl.trim()}, extract core features, pricing, and claims, verify exact DOM quotations, and generate a battlecard package.`);
                  }}
                  className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Apply to Prompt
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                <span className="text-slate-400 font-medium">Quick Live Presets:</span>
                {[
                  { label: 'Hacker News Live', url: 'https://news.ycombinator.com' },
                  { label: 'Wikipedia AI', url: 'https://en.wikipedia.org/wiki/Artificial_intelligence' },
                  { label: 'GitHub Trending', url: 'https://github.com/trending' }
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setLiveUrl(p.url);
                      setPrompt(`Browse ${p.url}, extract core features, pricing, and claims, verify exact DOM quotations, and generate a battlecard package.`);
                    }}
                    className="px-2 py-0.5 rounded bg-white dark:bg-workspace-800 border border-slate-200 dark:border-workspace-700 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-300 transition-colors cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Textarea */}
            <div>
              <label htmlFor="mission-prompt" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                Task Specification (Natural Language Prompt)
              </label>
              <textarea
                id="mission-prompt"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your research task, target entities, required fields, and desired verification rules..."
                className="w-full rounded-xl bg-slate-50 dark:bg-workspace-900 border border-slate-200 dark:border-workspace-700 p-4 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-workspace-900 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all leading-relaxed"
                required
              />
            </div>

            {/* Autonomy Level */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Browser Autonomy & Permissions
                </label>
                <span className="text-[11px] text-slate-400">Controls what the agent is allowed to do</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'READ_ONLY_RESEARCH', label: 'Read-Only', desc: 'No form fills' },
                    { id: 'INTERACTIVE_NAVIGATION', label: 'Interactive', desc: 'Clicks & tabs' },
                    { id: 'FORM_INTERACTION', label: 'Form Fill', desc: 'Inputs permitted' },
                    { id: 'HIGH_IMPACT_ACTIONS', label: 'High Impact', desc: 'Requires approval' }
                  ] as const
                ).map((level) => {
                  const isActive = autonomyLevel === level.id;
                  return (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => setAutonomyLevel(level.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        isActive
                          ? 'bg-cyan-50 dark:bg-workspace-750 border-cyan-500 dark:border-brand-cyan text-slate-900 dark:text-white ring-1 ring-cyan-500 dark:ring-brand-cyan'
                          : 'bg-slate-50 dark:bg-workspace-900 border-slate-200 dark:border-workspace-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      <div className="font-bold text-xs text-slate-800 dark:text-slate-200">{level.label}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{level.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Launch Action */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-workspace-800">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                SSRF-Protected Headless Chromium • Zero Fake Facts
              </span>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-sm shadow-md shadow-cyan-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Compiling DAG Plan...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Compile & Run Mission</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right 1 Col: Guarantees & Why It Matters */}
        <div className="rounded-2xl bg-white dark:bg-workspace-900 p-6 sm:p-7 border border-slate-200/90 dark:border-workspace-700/80 shadow-sm space-y-5">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-base pb-3 border-b border-slate-100 dark:border-workspace-800">
            <Shield className="w-4 h-4 text-cyan-600 dark:text-brand-cyan" />
            <span>Why PARALLAX is Different</span>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-workspace-850 border border-slate-200/80 dark:border-workspace-700/70 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-cyan-700 dark:text-brand-cyan">
                <Layers className="w-3.5 h-3.5" />
                <span>1. Verified DOM Evidence</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Every extracted claim links to exact quoted sentences, DOM locators, and SHA-256 snapshot hashes. No blind trust.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-workspace-850 border border-slate-200/80 dark:border-workspace-700/70 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-400">
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>2. Deterministic Verification</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Rules run independently from LLMs: exact string matching, currency ranges, contradiction audits, and file readbacks.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-workspace-850 border border-slate-200/80 dark:border-workspace-700/70 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
                <GitBranch className="w-3.5 h-3.5" />
                <span>3. Live Source-Drift Detection</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                When websites change, PARALLAX pinpoints the exact claims that became outdated and revalidates only affected paths.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-workspace-850 border border-slate-200/80 dark:border-workspace-700/70 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                <FileText className="w-3.5 h-3.5" />
                <span>4. Verified Deliverables</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                CSV, Markdown, and JSON files are verified through disk readback before mission completion.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Missions Table */}
      <div className="rounded-2xl bg-white dark:bg-workspace-900 border border-slate-200/90 dark:border-workspace-700/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-workspace-700 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Mission Trajectory Ledger</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Persistent database-backed mission runs and audit verdicts</p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-workspace-800 px-2.5 py-1 rounded-md">
            {missions.length} mission{missions.length === 1 ? '' : 's'} recorded
          </span>
        </div>

        {isLoadingMissions ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-600 dark:text-brand-cyan" />
            <span>Loading mission trajectories...</span>
          </div>
        ) : missions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <Compass className="w-8 h-8 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-slate-700 dark:text-slate-300 font-semibold">No missions created yet</p>
            <p className="text-xs text-slate-400 mt-1">Select a preset above and click "Compile & Run Mission" to start your first verified mission.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-workspace-900/90 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-workspace-700">
                <tr>
                  <th className="px-6 py-3.5">Mission Title</th>
                  <th className="px-6 py-3.5">Execution Status</th>
                  <th className="px-6 py-3.5">Verification Verdict</th>
                  <th className="px-6 py-3.5">Policy Level</th>
                  <th className="px-6 py-3.5">Created At</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-workspace-700/60 text-slate-600 dark:text-slate-300">
                {missions.map((m) => {
                  const isCompleted = m.status === 'completed';
                  const isRunning = m.status === 'running';

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-workspace-800/40 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 max-w-xs">{m.title}</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 max-w-xs font-mono">{m.rawPrompt}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase ${
                          isRunning
                            ? 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30 animate-pulse'
                            : isCompleted
                            ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                            : m.status === 'failed'
                            ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                            : 'bg-slate-100 dark:bg-slate-700/40 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isRunning ? 'bg-cyan-500' : isCompleted ? 'bg-emerald-500' : 'bg-slate-400'
                          }`} />
                          {m.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {m.verdict ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold font-mono uppercase ${
                            m.verdict === 'PASS'
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40'
                              : m.verdict === 'FAIL'
                              ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40'
                              : 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40'
                          }`}>
                            {m.verdict === 'PASS' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                            {m.verdict}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unevaluated</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {m.autonomyLevel}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {new Date(m.createdAt).toLocaleDateString()} {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => navigate(`/missions/${m.id}/live`)}
                            className="p-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-workspace-800 dark:hover:bg-workspace-700 text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                            title="Open Live Execution View"
                          >
                            <Play className="w-3.5 h-3.5 text-cyan-600" />
                            <span>Live</span>
                          </button>
                          <button
                            onClick={() => navigate(`/missions/${m.id}/lineage`)}
                            className="p-1.5 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-workspace-800 dark:hover:bg-workspace-700 text-indigo-700 dark:text-brand-cyan text-xs flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                            title="Inspect Lineage Graph"
                          >
                            <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Lineage</span>
                          </button>
                          <button
                            onClick={() => navigate(`/missions/${m.id}/report`)}
                            className="p-1.5 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-workspace-800 dark:hover:bg-workspace-700 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                            title="View Verification Report"
                          >
                            <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Report</span>
                          </button>
                          <button
                            onClick={() => navigate(`/missions/${m.id}/gtm`)}
                            className="p-1.5 px-2.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 dark:bg-workspace-800 dark:hover:bg-workspace-700 text-cyan-800 dark:text-cyan-300 text-xs flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                            title="Open Multimodal GTM Studio"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                            <span>GTM</span>
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
