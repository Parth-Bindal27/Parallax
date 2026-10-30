import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar.js';

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 dark:bg-workspace-950 dark:text-slate-100 selection:bg-brand-cyan/20 selection:text-brand-cyan transition-colors">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 dark:border-workspace-800/80 py-6 text-center text-xs text-slate-500 bg-white/60 dark:bg-workspace-950/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between px-6 gap-2">
          <span className="font-medium text-slate-600 dark:text-slate-400">PARALLAX — Autonomous Verified Web Missions with Traceable Evidence Lineage</span>
          <span className="font-mono text-slate-400 dark:text-slate-600 text-[11px]">Deterministic Verification • Zero Synthetics • Source Drift Resilient</span>
        </div>
      </footer>
    </div>
  );
}
