import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Compass,
  PlayCircle,
  FileCheck2,
  GitBranch,
  Settings,
  Layers,
  Sun,
  Moon,
  FlaskConical
} from 'lucide-react';
import { api } from '../api/client.js';

export function Navbar() {
  const location = useLocation();
  const params = useParams<{ id?: string }>();
  
  // Extract mission ID from path if present
  const pathMatch = location.pathname.match(/\/missions\/([a-zA-Z0-9-]+)/);
  const activeMissionId = params.id || (pathMatch ? pathMatch[1] : null);

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.getHealth(),
    refetchInterval: 6000
  });

  const { data: missionData } = useQuery({
    queryKey: ['mission', activeMissionId],
    queryFn: () => (activeMissionId ? api.getMission(activeMissionId) : null),
    enabled: !!activeMissionId
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('color-scheme') as 'dark' | 'light') || 'dark';
  });

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('color-scheme', next);
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute('content', next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const navLinks = [
    { name: 'Workspace', path: '/', icon: Compass, enabled: true },
    {
      name: 'Live Execution',
      path: activeMissionId ? `/missions/${activeMissionId}/live` : '/missions/latest/live',
      icon: PlayCircle,
      enabled: !!activeMissionId
    },
    {
      name: 'Evidence Explorer',
      path: activeMissionId ? `/missions/${activeMissionId}/evidence` : '#',
      icon: Layers,
      enabled: !!activeMissionId
    },
    {
      name: 'Lineage & Drift Map',
      path: activeMissionId ? `/missions/${activeMissionId}/lineage` : '#',
      icon: GitBranch,
      enabled: !!activeMissionId,
      badge: 'Signature'
    },
    {
      name: 'Verification Report',
      path: activeMissionId ? `/missions/${activeMissionId}/report` : '#',
      icon: FileCheck2,
      enabled: !!activeMissionId
    },
    { name: 'Settings', path: '/settings', icon: Settings, enabled: true }
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-workspace-700/60 px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-cyan to-brand-indigo flex items-center justify-center shadow-lg shadow-brand-cyan/20 group-hover:scale-105 transition-transform">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-wider text-white">PARALLAX</span>
                <span className="text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded bg-brand-cyan/15 text-brand-cyan font-semibold border border-brand-cyan/30">
                  VERIFIED
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium tracking-tight">Verified Web Missions</p>
            </div>
          </Link>

          {/* Active Mission Pill */}
          {missionData?.mission && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-workspace-800/80 border border-workspace-700 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-medium text-slate-200 truncate max-w-[200px]">
                {missionData.mission.title}
              </span>
              {missionData.mission.verdict && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  missionData.mission.verdict === 'PASS'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {missionData.mission.verdict}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1">
          {navLinks.map(link => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path || (link.path !== '/' && location.pathname.startsWith(link.path));
            if (!link.enabled) {
              return (
                <span
                  key={link.name}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 cursor-not-allowed select-none"
                  title="Select or start a mission first"
                >
                  <Icon className="w-4 h-4 opacity-40" />
                  <span>{link.name}</span>
                </span>
              );
            }
            return (
              <Link
                key={link.name}
                to={link.path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all relative ${
                  isActive
                    ? 'bg-workspace-750 text-brand-cyan border border-brand-cyan/30 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-workspace-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-cyan' : 'text-slate-400'}`} />
                <span>{link.name}</span>
                {link.badge && (
                  <span className="text-[9px] font-semibold bg-brand-indigo/30 text-indigo-300 px-1 py-0.2 rounded border border-indigo-500/40">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Status / Diagnostics Bar */}
        <div className="flex items-center gap-3">
          {/* Fixture Drift Indicator */}
          {health?.fixtureMutated && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-medium animate-pulse">
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Fixture Mutated (Drift Active)</span>
            </div>
          )}

          {/* Provider Pill */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-workspace-800 border border-workspace-700 text-slate-300 text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span>{health?.provider?.name || 'Deterministic Demo'}</span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle Color Scheme"
            className="p-1.5 rounded-lg bg-workspace-800 border border-workspace-700 text-slate-300 hover:text-white hover:bg-workspace-750 transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-300" />}
          </button>
        </div>
      </div>
    </header>
  );
}
