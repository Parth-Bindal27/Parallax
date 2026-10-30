import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  Pause,
  XCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Globe,
  Camera,
  FileCheck2,
  GitBranch,
  ShieldAlert,
  Terminal
} from 'lucide-react';
import { api } from '../api/client.js';
import type { BrowserActionEvent, MissionEvent } from '@parallax/shared';

export function LiveExecution() {
  const { id: missionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedAction, setSelectedAction] = useState<BrowserActionEvent | null>(null);

  // If no mission ID, redirect to workspace
  useEffect(() => {
    if (!missionId) {
      navigate('/');
    }
  }, [missionId, navigate]);

  // Fetch Mission & Nodes
  const { data: missionData, refetch: refetchMission } = useQuery({
    queryKey: ['mission', missionId],
    queryFn: () => (missionId ? api.getMission(missionId) : null),
    enabled: !!missionId,
    refetchInterval: 3000
  });

  // Fetch Browser Actions
  const { data: actionsData, refetch: refetchActions } = useQuery({
    queryKey: ['browserActions', missionId],
    queryFn: () => (missionId ? api.getBrowserActions(missionId) : null),
    enabled: !!missionId,
    refetchInterval: 3000
  });

  // Fetch Claims
  const { data: claimsData } = useQuery({
    queryKey: ['claims', missionId],
    queryFn: () => (missionId ? api.getClaims(missionId) : null),
    enabled: !!missionId,
    refetchInterval: 4000
  });

  // Fetch Evidence
  const { data: evidenceData } = useQuery({
    queryKey: ['evidence', missionId],
    queryFn: () => (missionId ? api.getEvidence(missionId) : null),
    enabled: !!missionId,
    refetchInterval: 4000
  });

  // Fetch Approvals
  const { data: approvalsData, refetch: refetchApprovals } = useQuery({
    queryKey: ['approvals', missionId],
    queryFn: () => (missionId ? api.getApprovals(missionId) : null),
    enabled: !!missionId,
    refetchInterval: 2500
  });

  // SSE Event Stream Subscription
  useEffect(() => {
    if (!missionId) return;

    const eventSource = new EventSource(`/api/v1/missions/${missionId}/events`);

    eventSource.onmessage = (event) => {
      try {
        const parsed: MissionEvent = JSON.parse(event.data);

        if (parsed.type.includes('node') || parsed.type.includes('mission')) {
          refetchMission();
          queryClient.invalidateQueries({ queryKey: ['evidence', missionId] });
          queryClient.invalidateQueries({ queryKey: ['claims', missionId] });
          queryClient.invalidateQueries({ queryKey: ['artifacts', missionId] });
        }
        if (parsed.type.includes('claim') || parsed.type.includes('evidence')) {
          queryClient.invalidateQueries({ queryKey: ['evidence', missionId] });
          queryClient.invalidateQueries({ queryKey: ['claims', missionId] });
        }
        if (parsed.type.includes('browser_action')) {
          refetchActions();
        }
        if (parsed.type.includes('approval')) {
          refetchApprovals();
        }
      } catch (err) {
        console.error('Failed to parse SSE event', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [missionId, refetchMission, refetchActions, refetchApprovals]);

  // Controls Mutations
  const pauseMutation = useMutation({
    mutationFn: () => api.pauseMission(missionId!),
    onSuccess: () => refetchMission()
  });

  const resumeMutation = useMutation({
    mutationFn: () => api.resumeMission(missionId!),
    onSuccess: () => refetchMission()
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelMission(missionId!),
    onSuccess: () => refetchMission()
  });

  const resolveApprovalMutation = useMutation({
    mutationFn: ({ approvalId, decision }: { approvalId: string; decision: 'approve' | 'deny' }) =>
      api.resolveApproval(approvalId, decision),
    onSuccess: () => refetchApprovals()
  });

  const mission = missionData?.mission;
  const nodes = missionData?.nodes || [];
  const actions = actionsData?.actions || [];
  const claims = claimsData?.claims || [];
  const evidence = evidenceData?.evidence || [];
  const approvals = approvalsData?.approvals || [];
  const pendingApprovals = approvals.filter((a) => a.status === 'pending');

  // Stats calculation
  const completedNodesCount = nodes.filter((n) => n.status === 'completed').length;
  const progressPercent = nodes.length > 0 ? Math.round((completedNodesCount / nodes.length) * 100) : 0;

  const verifiedClaimsCount = claims.filter((c) => c.verificationStatus === 'verified').length;
  const staleClaimsCount = claims.filter((c) => c.verificationStatus === 'stale').length;

  const latestAction = actions[actions.length - 1] || null;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner / Mission Controls */}
      <div className="rounded-2xl bg-white dark:bg-workspace-900 p-6 sm:p-7 border border-slate-200/90 dark:border-workspace-700/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">{mission?.title || 'Mission Trajectory'}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                mission?.status === 'running'
                  ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30 animate-pulse'
                  : mission?.status === 'completed'
                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                  : mission?.status === 'paused'
                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                  : 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
              }`}>
                {mission?.status || 'INITIALIZING'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">{mission?.rawPrompt}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {mission?.status === 'running' ? (
              <button
                onClick={() => pauseMutation.mutate()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-50 dark:bg-workspace-800 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-xs font-bold transition-colors cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </button>
            ) : mission?.status === 'paused' ? (
              <button
                onClick={() => resumeMutation.mutate()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume</span>
              </button>
            ) : null}

            {['running', 'paused'].includes(mission?.status || '') && (
              <button
                onClick={() => cancelMutation.mutate()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-50 dark:bg-workspace-800 hover:bg-rose-100 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-xs font-bold transition-colors cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            )}

            <button
              onClick={() => navigate(`/missions/${missionId}/lineage`)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-50 dark:bg-brand-cyan/20 hover:bg-cyan-100 text-cyan-800 dark:text-brand-cyan border border-cyan-200 dark:border-brand-cyan/40 text-xs font-bold transition-colors cursor-pointer"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Lineage Map</span>
            </button>

            <button
              onClick={() => navigate(`/missions/${missionId}/report`)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Report</span>
            </button>
          </div>
        </div>

        {/* Progress Bar & Real Metric Tickers */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400 font-medium">DAG Execution Progress ({completedNodesCount}/{nodes.length} nodes)</span>
            <span className="font-mono font-bold text-cyan-700 dark:text-brand-cyan">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-workspace-900 border border-slate-200 dark:border-workspace-700/60 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-600 to-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Ticker Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-workspace-900/80 border border-slate-200/80 dark:border-workspace-700/70">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Captured Evidence</span>
            <span className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-0.5 block">{evidence.length}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-workspace-900/80 border border-slate-200/80 dark:border-workspace-700/70">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Verified Claims</span>
            <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">{verifiedClaimsCount}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-workspace-900/80 border border-slate-200/80 dark:border-workspace-700/70">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Stale Claims</span>
            <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5 block">{staleClaimsCount}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-workspace-900/80 border border-slate-200/80 dark:border-workspace-700/70">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Browser Actions</span>
            <span className="text-xl font-bold font-mono text-cyan-600 dark:text-cyan-400 mt-0.5 block">{actions.length}</span>
          </div>
        </div>
      </div>

      {/* Pending Approval Dialog (if policy stopped action) */}
      {pendingApprovals.length > 0 && (
        <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-300 dark:border-amber-500/50 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-sm">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <span>Action Approval Required Under Autonomy Policy</span>
          </div>
          {pendingApprovals.map((app) => (
            <div key={app.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3.5 rounded-xl bg-white dark:bg-workspace-900/90 border border-amber-200 dark:border-amber-500/30">
              <div>
                <p className="text-xs text-slate-800 dark:text-slate-200 font-bold">Action: {app.actionType} on {app.target}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{app.reason}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => resolveApprovalMutation.mutate({ approvalId: app.id, decision: 'approve' })}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Approve Action
                </button>
                <button
                  onClick={() => resolveApprovalMutation.mutate({ approvalId: app.id, decision: 'deny' })}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Deny Action
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Execution DAG Nodes Grid */}
      <div className="rounded-2xl bg-white dark:bg-workspace-900 p-6 sm:p-7 border border-slate-200/90 dark:border-workspace-700/80 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-cyan-600 dark:text-brand-cyan" />
          <span>Execution DAG Stages</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {nodes.map((node) => {
            const isCompleted = node.status === 'completed';
            const isRunning = node.status === 'running';
            const isFailed = node.status === 'failed';

            return (
              <div
                key={node.id}
                className={`p-4 rounded-xl border transition-all ${
                  isRunning
                    ? 'bg-cyan-50 dark:bg-workspace-800 border-cyan-400 shadow-sm'
                    : isCompleted
                    ? 'bg-emerald-50/60 dark:bg-workspace-850/80 border-emerald-200 dark:border-emerald-500/40'
                    : isFailed
                    ? 'bg-rose-50 dark:bg-workspace-850/80 border-rose-300 dark:border-rose-500/50'
                    : 'bg-slate-50 dark:bg-workspace-900/60 border-slate-200 dark:border-workspace-700/60 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${
                    isRunning ? 'text-cyan-700 dark:text-cyan-300' : isCompleted ? 'text-emerald-700 dark:text-emerald-300' : isFailed ? 'text-rose-700 dark:text-rose-300' : 'text-slate-400'
                  }`}>
                    {node.nodeType.replace(/_/g, ' ')}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : isRunning ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-ping" />
                  ) : isFailed ? (
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                  )}
                </div>
                <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100">{node.label}</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{node.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column: Live Browser Inspector & Action Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Playwright Browser View */}
        <div className="rounded-2xl bg-white dark:bg-workspace-900 p-6 sm:p-7 border border-slate-200/90 dark:border-workspace-700/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-600 dark:text-brand-cyan" />
              <span>Chromium Browser Session</span>
            </h2>
            <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Headless Active
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-workspace-900 border border-slate-200 dark:border-workspace-700 text-xs font-mono flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <span className="text-slate-400">URL:</span>
            <span className="truncate text-cyan-700 dark:text-cyan-300 font-semibold">{latestAction?.url || 'Awaiting initial navigation...'}</span>
          </div>

          {/* Browser Viewport Visualizer */}
          <div className="aspect-[16/10] rounded-xl bg-slate-100 dark:bg-workspace-950 border border-slate-200 dark:border-workspace-700 flex flex-col items-center justify-center p-6 text-center text-slate-500 dark:text-slate-400 overflow-hidden relative group">
            {latestAction?.screenshotPath ? (
              <img
                src={latestAction.screenshotPath}
                alt="Browser Viewport"
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <div className="space-y-3">
                <Camera className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-xs text-slate-600 dark:text-slate-400 font-bold">Automated Page Snapshot Captured</p>
                <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                  DOM state normalized and SHA-256 fingerprint recorded in snapshot ledger.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Action Log Stream */}
        <div className="rounded-2xl bg-white dark:bg-workspace-900 p-6 sm:p-7 border border-slate-200/90 dark:border-workspace-700/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-600 dark:text-brand-indigo" />
              <span>Browser Action Event Stream</span>
            </h2>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-workspace-800 px-2 py-0.5 rounded">
              {actions.length} actions
            </span>
          </div>

          <div className="h-80 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
            {actions.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <span>Waiting for browser action dispatch...</span>
              </div>
            ) : (
              actions.slice().reverse().map((act) => (
                <div
                  key={act.actionId}
                  onClick={() => setSelectedAction(act)}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-workspace-900/90 border border-slate-200 dark:border-workspace-700 hover:border-cyan-400 dark:hover:border-slate-500 cursor-pointer transition-colors space-y-1 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-800 dark:text-brand-cyan">{act.actionType}</span>
                    <span className="text-[10px] text-slate-400">{new Date(act.startTime).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">{act.url}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>Status: <strong className="text-emerald-600 dark:text-emerald-400">{act.status}</strong></span>
                    {act.selector && <span>Selector: {act.selector}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-workspace-900 border border-slate-200 dark:border-workspace-600 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-workspace-700 pb-3">
              <span className="font-bold text-slate-900 dark:text-white text-sm">Action: {selectedAction.actionType}</span>
              <button
                onClick={() => setSelectedAction(null)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-workspace-800 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div><strong>Target URL:</strong> <span className="text-cyan-700 dark:text-cyan-300 break-all">{selectedAction.url}</span></div>
              <div><strong>Status:</strong> <span className="text-emerald-600 dark:text-emerald-400">{selectedAction.status}</span></div>
              {selectedAction.selector && <div><strong>Selector:</strong> {selectedAction.selector}</div>}
              <div><strong>Start:</strong> {selectedAction.startTime}</div>
              <div><strong>Completion:</strong> {selectedAction.completionTime}</div>
              {selectedAction.error && <div className="text-rose-600 dark:text-rose-400"><strong>Error:</strong> {selectedAction.error}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
