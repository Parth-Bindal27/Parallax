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
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-brand-cyan" />
          <span>System Diagnostics & Sandbox Configuration</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Inspect execution boundaries, provider integrations, security parameters, and controlled test fixtures
        </p>
      </div>

      {notification && (
        <div className="p-4 rounded-xl bg-brand-cyan/15 border border-brand-cyan/40 text-brand-cyan text-xs flex items-center gap-2 font-mono">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Grid of Settings Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LLM Provider Configuration */}
        <div className="glass-panel rounded-xl p-6 border border-workspace-700/80 shadow-md space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Cpu className="w-4 h-4 text-brand-cyan" />
            <span>LLM Provider & Intent Compiler</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-workspace-900 border border-workspace-750">
              <span className="text-slate-400">Active Provider</span>
              <span className="font-mono font-bold text-brand-cyan">{settings?.provider?.name || 'demo-deterministic-v1'}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-workspace-900 border border-workspace-750">
              <span className="text-slate-400">Execution Mode</span>
              <span className="font-mono text-slate-200">{settings?.provider?.mode || 'Deterministic Demo Mode'}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-workspace-900 border border-workspace-750">
              <span className="text-slate-400">API Key Redaction</span>
              <span className="font-mono text-emerald-400">●●●●●●●● (Protected)</span>
            </div>
          </div>
        </div>

        {/* Browser Sandbox & Security Policies */}
        <div className="glass-panel rounded-xl p-6 border border-workspace-700/80 shadow-md space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Browser Security & SSRF Protection</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-workspace-900 border border-workspace-750">
              <span className="text-slate-400">SSRF Enforcement</span>
              <span className="font-mono font-bold text-emerald-400">
                {settings?.ssrfProtectionEnabled ? 'ACTIVE (Loopback/Private/Cloud Blocked)' : 'DISABLED'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-workspace-900 border border-workspace-750">
              <span className="text-slate-400">Local Fixture Exemption</span>
              <span className="font-mono text-cyan-300">
                {settings?.allowLocalFixtures ? 'ENABLED (Safe Port 3001 Allowed)' : 'DISABLED'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-workspace-900 border border-workspace-750">
              <span className="text-slate-400">Default Autonomy Level</span>
              <span className="font-mono text-slate-200">{settings?.defaultAutonomyLevel}</span>
            </div>
          </div>
        </div>

        {/* Controlled Demo Fixtures Manager */}
        <div className="glass-panel rounded-xl p-6 border border-workspace-700/80 shadow-md space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <FlaskConical className="w-4 h-4 text-amber-400" />
              <span>Controlled Local Test Fixture (Source-Drift Demonstration)</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
              health?.fixtureMutated ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              {health?.fixtureMutated ? 'Mutated (Drift Active)' : 'Baseline State'}
            </span>
          </div>

          <p className="text-xs text-slate-400">
            PARALLAX serves an internal mock web portal at <a href="/fixtures/student-ai-tools" target="_blank" className="text-brand-cyan hover:underline font-mono">/fixtures/student-ai-tools</a> for deterministic end-to-end testing of browser navigation, snapshotting, verification, and drift detection.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => mutateFixture.mutate('price_increase')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-all cursor-pointer"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Mutate Fixture (StudyPilot AI ₹499 → ₹699)</span>
            </button>

            <button
              onClick={() => resetFixture.mutate()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-workspace-800 hover:bg-workspace-750 text-slate-200 border border-workspace-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Reset to Baseline</span>
            </button>

            <a
              href="/fixtures/student-ai-tools"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-workspace-850 hover:bg-workspace-800 text-slate-300 text-xs font-semibold border border-workspace-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-brand-cyan" />
              <span>Open Fixture in Browser</span>
            </a>
          </div>
        </div>

        {/* Database & Storage Diagnostics */}
        <div className="glass-panel rounded-xl p-6 border border-workspace-700/80 shadow-md space-y-4 md:col-span-2">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Database className="w-4 h-4 text-purple-400" />
            <span>Persistence & Storage Health</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-workspace-900 border border-workspace-750">
              <span className="text-slate-400 block mb-1">SQLite Database</span>
              <span className="font-mono text-slate-200 break-all">{settings?.databasePath}</span>
              <span className="text-[10px] text-emerald-400 block mt-1">● Connected (WAL mode)</span>
            </div>
            <div className="p-3 rounded-lg bg-workspace-900 border border-workspace-750">
              <span className="text-slate-400 block mb-1">Snapshot Storage</span>
              <span className="font-mono text-slate-200 break-all">{settings?.snapshotsPath}</span>
              <span className="text-[10px] text-slate-400 block mt-1">Raw HTML & Hashes</span>
            </div>
            <div className="p-3 rounded-lg bg-workspace-900 border border-workspace-750">
              <span className="text-slate-400 block mb-1">Artifact Storage</span>
              <span className="font-mono text-slate-200 break-all">{settings?.artifactsPath}</span>
              <span className="text-[10px] text-slate-400 block mt-1">CSV, MD, JSON, HTML</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
