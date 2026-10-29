import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar.js';

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-workspace-950 text-slate-100 selection:bg-brand-cyan/20 selection:text-brand-cyan">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-workspace-800/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between px-6 gap-2">
          <span>PARALLAX — Autonomous Verified Web Missions with Traceable Evidence Lineage</span>
          <span className="font-mono text-slate-600">Deterministic Verification • Zero Synthetics • Source Drift Resilient</span>
        </div>
      </footer>
    </div>
  );
}
