import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings as SettingsIcon,
  Shield,
  Cpu,
  Database,
  FlaskConical,
  RotateCw,
  ExternalLink,
  Info
} from 'lucide-react';
import { api } from '../api/client.js';

export function Settings() {
  const queryClient = useQueryClient();
  const [notification, setNotification] = useState<string | null>(null);

  // Fetch Settings
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.getSettings()
  });

  // Fetch Health
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.getHealth()
  });

  // Mutations for Fixture
  const mutateFixture = useMutation({
    mutationFn: (type: 'price_increase' | 'feature_removal') => api.mutateFixture(type),
    onSuccess: (data) => {
      setNotification(`Fixture successfully mutated (${data.result.mutationType}). StudyPilot AI price updated to ₹${data.result.newPrice}.`);
      queryClient.invalidateQueries({ queryKey: ['health'] });
    }
  });

  const resetFixture = useMutation({
    mutationFn: () => api.resetFixture(),
    onSuccess: () => {
      setNotification('Fixture successfully reset to baseline state.');
      queryClient.invalidateQueries({ queryKey: ['health'] });
    }
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-cyan-600 dark:text-brand-cyan" />
          <span>System Diagnostics & Sandbox Configuration</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Inspect execution boundaries, provider integrations, security parameters, and controlled test fixtures.
        </p>
      </div>

      {notification && (
        <div className="p-4 rounded-2xl bg-cyan-50 dark:bg-brand-cyan/15 border border-cyan-200 dark:border-brand-cyan/40 text-cyan-900 dark:text-brand-cyan text-xs flex items-center gap-2 font-mono">
          <Info className="w-4 h-4 flex-shrink-0 text-cyan-600" />
          <span>{notification}</span>
        </div>
      )}

      {/* Grid of Settings Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LLM Provider Configuration */}
        <div className="rounded-2xl bg-white dark:bg-workspace-900 p-6 border border-slate-200/90 dark:border-workspace-700/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
            <Cpu className="w-4 h-4 text-cyan-600 dark:text-brand-cyan" />
            <span>LLM Provider & Intent Compiler</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-workspace-900 border border-slate-200 dark:border-workspace-750">
              <span className="text-slate-500 dark:text-slate-400">Active Provider</span>
              <span className="font-mono font-bold text-cyan-700 dark:text-brand-cyan">{settings?.provider?.name || 'demo-deterministic-v1'}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-workspace-900 border border-slate-200 dark:border-workspace-750">
              <span className="text-slate-500 dark:text-slate-400">Execution Mode</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{settings?.provider?.mode || 'Deterministic Demo Mode'}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-workspace-900 border border-slate-200 dark:border-workspace-750">
              <span className="text-slate-500 dark:text-slate-400">API Key Redaction</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">●●●●●●●● (Protected)</span>
            </div>
          </div>
        </div>

        {/* Browser Sandbox & Security Policies */}
        <div className="rounded-2xl bg-white dark:bg-workspace-900 p-6 border border-slate-200/90 dark:border-workspace-700/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
            <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Browser Security & SSRF Protection</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-workspace-900 border border-slate-200 dark:border-workspace-750">
              <span className="text-slate-500 dark:text-slate-400">SSRF Enforcement</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {settings?.ssrfProtectionEnabled ? 'ACTIVE (Loopback/Private/Cloud Blocked)' : 'DISABLED'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-workspace-900 border border-slate-200 dark:border-workspace-750">
              <span className="text-slate-500 dark:text-slate-400">Local Fixture Exemption</span>
              <span className="font-mono text-cyan-700 dark:text-cyan-300 font-bold">
                {settings?.allowLocalFixtures ? 'ENABLED (Safe Port 3001 Allowed)' : 'DISABLED'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-workspace-900 border border-slate-200 dark:border-workspace-750">
              <span className="text-slate-500 dark:text-slate-400">Default Autonomy Level</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{settings?.defaultAutonomyLevel}</span>
            </div>
          </div>
        </div>

        {/* Controlled Demo Fixtures Manager */}
        <div className="rounded-2xl bg-white dark:bg-workspace-900 p-6 border border-slate-200/90 dark:border-workspace-700/80 shadow-sm space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
              <FlaskConical className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Controlled Local Test Fixture (Source-Drift Demonstration)</span>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
              health?.fixtureMutated ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
            }`}>
              {health?.fixtureMutated ? 'Mutated (Drift Active)' : 'Baseline State'}
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            PARALLAX serves an internal mock web portal at <a href="/fixtures/student-ai-tools" target="_blank" className="text-cyan-600 dark:text-brand-cyan hover:underline font-mono font-bold">/fixtures/student-ai-tools</a> for deterministic end-to-end testing of browser navigation, snapshotting, verification, and drift detection.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => mutateFixture.mutate('price_increase')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Mutate Fixture (StudyPilot AI ₹499 → ₹699)</span>
            </button>

            <button
              onClick={() => resetFixture.mutate()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-workspace-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-workspace-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Reset to Baseline</span>
            </button>

            <a
              href="/fixtures/student-ai-tools"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-workspace-850 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-workspace-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-600 dark:text-brand-cyan" />
              <span>Open Fixture in Browser</span>
            </a>
          </div>
        </div>

        {/* Database & Storage Diagnostics */}
        <div className="rounded-2xl bg-white dark:bg-workspace-900 p-6 border border-slate-200/90 dark:border-workspace-700/80 shadow-sm space-y-4 md:col-span-2">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
            <Database className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Persistence & Storage Health</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-workspace-900 border border-slate-200 dark:border-workspace-750">
              <span className="text-slate-500 dark:text-slate-400 block mb-1">SQLite Database</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 break-all font-semibold">{settings?.databasePath}</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block mt-1">● Connected (WAL mode)</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-workspace-900 border border-slate-200 dark:border-workspace-750">
              <span className="text-slate-500 dark:text-slate-400 block mb-1">Snapshot Storage</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 break-all font-semibold">{settings?.snapshotsPath}</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-1">Raw HTML & Hashes</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-workspace-900 border border-slate-200 dark:border-workspace-750">
              <span className="text-slate-500 dark:text-slate-400 block mb-1">Artifact Storage</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 break-all font-semibold">{settings?.artifactsPath}</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-1">CSV, MD, JSON, HTML</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
