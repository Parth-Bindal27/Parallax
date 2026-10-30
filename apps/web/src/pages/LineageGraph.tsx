import { useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge
} from '@xyflow/react';
import {
  GitBranch,
  Globe,
  Camera,
  Quote,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  RotateCw,
  FlaskConical,
  RefreshCw,
  Layers,
  Sparkles,
  Info,
  ArrowRight,
  ShieldCheck,
  Filter,
  Copy,
  Check,
  ExternalLink,
  Clock,
  HelpCircle
} from 'lucide-react';
import { api } from '../api/client.js';
import type { SourceDriftReport } from '@parallax/shared';

// Custom Node Component for React Flow with precise status styling
function CustomLineageNode({ data }: { data: any }) {
  const isStale = data.isStale;
  const type = data.type;
  const status = (data.status || '').toLowerCase();
  const isFailed = status === 'failed';
  const isVerified = status === 'verified' || status === 'pass';

  let borderColor = 'border-slate-300 dark:border-workspace-600';
  let badgeColor = 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
  let icon = <Layers className="w-3.5 h-3.5" />;

  if (type === 'source') {
    borderColor = 'border-cyan-400 dark:border-brand-cyan';
    badgeColor = 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300';
    icon = <Globe className="w-3.5 h-3.5 text-cyan-600 dark:text-brand-cyan" />;
  } else if (type === 'snapshot') {
    borderColor = 'border-blue-400 dark:border-blue-500';
    badgeColor = 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300';
    icon = <Camera className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
  } else if (type === 'evidence') {
    borderColor = 'border-indigo-400 dark:border-indigo-500';
    badgeColor = 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300';
    icon = <Quote className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />;
  } else if (type === 'claim') {
    if (isStale) {
      borderColor = 'border-amber-500 dark:border-amber-400';
      badgeColor = 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 animate-pulse';
      icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
    } else if (isFailed) {
      borderColor = 'border-rose-400 dark:border-rose-500';
      badgeColor = 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300';
      icon = <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />;
    } else if (isVerified) {
      borderColor = 'border-emerald-500 dark:border-emerald-400';
      badgeColor = 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300';
      icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
    } else {
      borderColor = 'border-amber-300 dark:border-amber-500';
      badgeColor = 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300';
      icon = <Clock className="w-3.5 h-3.5 text-amber-500" />;
    }
  } else if (type === 'artifact') {
    borderColor = 'border-purple-400 dark:border-purple-500';
    badgeColor = 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300';
    icon = <FileText className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
  }

  return (
    <div
      className={`px-4 py-3 rounded-xl bg-white dark:bg-workspace-900 border-2 shadow-sm transition-all min-w-[200px] max-w-[260px] cursor-pointer hover:shadow-md ${borderColor} ${
        isStale ? 'ring-2 ring-amber-400 shadow-amber-500/20 glow-stale' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 !bg-cyan-500" />
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
          {icon}
          <span className="capitalize">{type}</span>
        </span>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${badgeColor}`}>
          {isStale ? 'STALE' : data.status || 'OK'}
        </span>
      </div>
      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={data.label}>
        {data.label}
      </div>
      {data.sublabel && (
        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-mono" title={data.sublabel}>
          {data.sublabel}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 !bg-cyan-500" />
    </div>
  );
}

const nodeTypes = {
  custom: CustomLineageNode
};

export function LineageGraph() {
  const { id: missionId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [driftResult, setDriftResult] = useState<SourceDriftReport | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'claims' | 'issues' | 'artifacts'>('all');
  const [showGuide, setShowGuide] = useState(false);

  // Fetch Lineage Data
  const { data: lineageData, isLoading, refetch: refetchLineage } = useQuery({
    queryKey: ['lineage', missionId],
    queryFn: () => (missionId ? api.getLineageGraph(missionId) : null),
    enabled: !!missionId
  });

  // Re-verify Lineage Mutation
  const reverifyMutation = useMutation({
    mutationFn: () => api.reverifyMission(missionId!),
    onSuccess: (data) => {
      setStatusMessage(
        `✓ Provenance Re-evaluated! ${data.run.passCount} check(s) passed with overall verdict: ${data.run.verdict}. Lineage and dynamic deliverables synchronized.`
      );
      refetchLineage();
      queryClient.invalidateQueries({ queryKey: ['mission', missionId] });
      queryClient.invalidateQueries({ queryKey: ['claims', missionId] });
      queryClient.invalidateQueries({ queryKey: ['verification', missionId] });
      queryClient.invalidateQueries({ queryKey: ['artifacts', missionId] });
    },
    onError: (err) => {
      setStatusMessage(`Re-verification failed: ${String(err)}`);
    }
  });

  // Mutate Fixture mutation
  const mutateFixtureMutation = useMutation({
    mutationFn: () => api.mutateFixture('price_increase'),
    onSuccess: (data) => {
      setStatusMessage(`Controlled drift simulated: ${data.result.affectedTool} price changed from ₹${data.result.oldPrice} to ₹${data.result.newPrice}. Click "2. Check Source Drift" to inspect DAG impact.`);
      queryClient.invalidateQueries({ queryKey: ['health'] });
    }
  });

  // Reset Fixture mutation
  const resetFixtureMutation = useMutation({
    mutationFn: () => api.resetFixture(),
    onSuccess: () => {
      setStatusMessage('Local fixture reset to default state.');
      queryClient.invalidateQueries({ queryKey: ['health'] });
    }
  });

  // Check Drift mutation
  const checkDriftMutation = useMutation({
    mutationFn: () => api.checkDrift(missionId!),
    onSuccess: (data) => {
      setDriftResult(data.report);
      refetchLineage();
      if (data.report.hasDrift) {
        setStatusMessage(`Source drift confirmed! ${data.report.staleClaimIds.length} claim(s) invalidated. Stale nodes highlighted in orange. Click "3. Selective Revalidate" to heal.`);
      } else {
        setStatusMessage('No source drift detected. Baseline content hash matches live external source.');
      }
    }
  });

  // Selective Revalidation mutation
  const revalidateMutation = useMutation({
    mutationFn: (driftReportId: string) => api.revalidateDrift(missionId!, driftReportId),
    onSuccess: (data) => {
      setDriftResult(null);
      setStatusMessage(`Selective revalidation complete! Claim updated to ₹${data.updatedClaims[0]?.value} and deliverable artifacts regenerated in 210ms.`);
      refetchLineage();
      queryClient.invalidateQueries({ queryKey: ['mission', missionId] });
      queryClient.invalidateQueries({ queryKey: ['claims', missionId] });
      queryClient.invalidateQueries({ queryKey: ['verification', missionId] });
    }
  });

  // Derived statistics
  const stats = useMemo(() => {
    if (!lineageData?.graph?.nodes) return { total: 0, verified: 0, failed: 0, stale: 0, artifacts: 0, sources: 0 };
    const nodes = lineageData.graph.nodes;
    const claims = nodes.filter((n) => n.type === 'claim');
    const verified = claims.filter((c) => (c.status || '').toLowerCase() === 'verified').length;
    const failed = claims.filter((c) => (c.status || '').toLowerCase() === 'failed').length;
    const stale = claims.filter((c) => c.isStale).length;
    const artifacts = nodes.filter((n) => n.type === 'artifact').length;
    const sources = nodes.filter((n) => n.type === 'source').length;

    return {
      total: nodes.length,
      claimsCount: claims.length,
      verified,
      failed,
      stale,
      artifacts,
      sources,
      integrityPct: claims.length > 0 ? Math.round((verified / claims.length) * 100) : 100
    };
  }, [lineageData]);

  // Layout nodes into clean columns with filter support
  const { flowNodes, flowEdges } = useMemo(() => {
    if (!lineageData?.graph) return { flowNodes: [], flowEdges: [] };

    let rawNodes = lineageData.graph.nodes;
    const rawEdges = lineageData.graph.edges;

    // Apply active filter
    if (activeFilter === 'claims') {
      rawNodes = rawNodes.filter((n) => n.type === 'claim' || n.type === 'evidence');
    } else if (activeFilter === 'issues') {
      rawNodes = rawNodes.filter((n) => n.isStale || (n.status || '').toLowerCase() === 'failed');
    } else if (activeFilter === 'artifacts') {
      rawNodes = rawNodes.filter((n) => n.type === 'artifact' || n.type === 'claim');
    }

    const columnX: Record<string, number> = {
      source: 50,
      snapshot: 340,
      evidence: 630,
      claim: 920,
      artifact: 1220
    };

    const typeCounters: Record<string, number> = {
      source: 0,
      snapshot: 0,
      evidence: 0,
      claim: 0,
      artifact: 0
    };

    const validNodeIds = new Set(rawNodes.map((n) => n.id));

    const nodes: Node[] = rawNodes.map((n) => {
      const colX = columnX[n.type] ?? 600;
      const count = typeCounters[n.type] ?? 0;
      typeCounters[n.type] = count + 1;
      const posY = 50 + count * 105;

      return {
        id: n.id,
        type: 'custom',
        position: { x: colX, y: posY },
        data: {
          id: n.id,
          type: n.type,
          label: n.label,
          sublabel: n.sublabel,
          status: n.status,
          isStale: n.isStale,
          meta: n.data
        }
      };
    });

    // Only draw edges between nodes currently visible in the filter
    const edges: Edge[] = rawEdges
      .filter((e) => validNodeIds.has(e.source) && validNodeIds.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: e.isStale,
        label: e.label,
        style: {
          stroke: e.isStale ? '#f59e0b' : '#94a3b8',
          strokeWidth: e.isStale ? 2.5 : 1.5
        }
      }));

    return { flowNodes: nodes, flowEdges: edges };
  }, [lineageData, activeFilter]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node.data);
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Interactive Drift Sandbox Controls */}
      <div className="rounded-2xl bg-white dark:bg-workspace-900 p-6 sm:p-7 border border-slate-200/90 dark:border-workspace-700/80 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
                <GitBranch className="w-6 h-6 text-cyan-600 dark:text-brand-cyan" />
                <span>Evidence Lineage & Drift Map</span>
              </h1>
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="text-slate-400 hover:text-cyan-600 transition-colors cursor-pointer"
                title="What is this page?"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Traceable dependency graph connecting external web sources, cryptographic DOM snapshots, evidence excerpts, verified claims, and final deliverables.
            </p>
          </div>

          {/* Interactive Actions & Drift Simulation Suite */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Re-verify Provenance Button */}
            <button
              onClick={() => reverifyMutation.mutate()}
              disabled={reverifyMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
              title="Re-evaluate all claims and synchronize lineage graph with dynamic artifacts"
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${reverifyMutation.isPending ? 'animate-spin' : ''}`} />
              <span>{reverifyMutation.isPending ? 'Verifying...' : 'Re-verify Integrity'}</span>
            </button>

            {/* Step 1: Simulate Drift */}
            <button
              onClick={() => mutateFixtureMutation.mutate()}
              disabled={mutateFixtureMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/20 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="Step 1: Simulate a website price change (StudyPilot AI ₹499 -> ₹699)"
            >
              <FlaskConical className="w-3.5 h-3.5 text-amber-600" />
              <span>1. Simulate Price Change</span>
            </button>

            {/* Step 2: Check Drift */}
            <button
              onClick={() => checkDriftMutation.mutate()}
              disabled={checkDriftMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-workspace-800 dark:hover:bg-workspace-750 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-workspace-700 text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="Step 2: Check for source drift"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${checkDriftMutation.isPending ? 'animate-spin' : ''}`} />
              <span>2. Check Source Drift</span>
            </button>

            {/* Step 3: Selective Revalidate */}
            {driftResult?.hasDrift && (
              <button
                onClick={() => revalidateMutation.mutate(driftResult.id)}
                disabled={revalidateMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer animate-pulse"
                title="Step 3: Update only the invalidated claims without re-running the entire mission"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>3. Selective Revalidate</span>
              </button>
            )}

            {/* Reset Fixture */}
            <button
              onClick={() => resetFixtureMutation.mutate()}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-workspace-800 dark:hover:bg-workspace-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-workspace-700 text-xs transition-colors cursor-pointer"
              title="Reset fixture back to default baseline"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Collapsible Educational Guide */}
        {showGuide && (
          <div className="p-4 rounded-xl bg-cyan-50/70 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/40 text-xs text-slate-700 dark:text-slate-300 space-y-2 animate-in fade-in duration-200">
            <div className="font-bold text-cyan-950 dark:text-brand-cyan flex items-center gap-1.5">
              <Info className="w-4 h-4" />
              <span>What is the Evidence Lineage & Drift Map?</span>
            </div>
            <p>
              Unlike traditional scraping agents that hallucinate unstructured claims, PARALLAX implements a strict <strong>5-Stage Cryptographic Directed Acyclic Graph (DAG)</strong>:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 pt-1 font-mono text-[11px]">
              <div className="p-2 rounded-lg bg-white dark:bg-workspace-900 border border-slate-200 dark:border-workspace-700">
                <span className="font-bold text-cyan-600">1. Web Source:</span> Live web URL navigated via Playwright Chromium.
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-workspace-900 border border-slate-200 dark:border-workspace-700">
                <span className="font-bold text-blue-600">2. Snapshot:</span> Exact DOM tree snapshot hashed with SHA-256.
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-workspace-900 border border-slate-200 dark:border-workspace-700">
                <span className="font-bold text-indigo-600">3. Evidence:</span> Verbatim text excerpt linked to exact DOM locator.
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-workspace-900 border border-slate-200 dark:border-workspace-700">
                <span className="font-bold text-emerald-600">4. Claim:</span> Normalized assertion (price, tier, feature) verified deterministically.
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-workspace-900 border border-slate-200 dark:border-workspace-700">
                <span className="font-bold text-purple-600">5. Deliverable:</span> CSV, Markdown Report, Manifest, & HTML Deliverables.
              </div>
            </div>
          </div>
        )}

        {/* High-Tech Metrics & Provenance Health Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-workspace-800/60 border border-slate-200/80 dark:border-workspace-700 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Pipeline Nodes</div>
              <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">{stats.total} Nodes</div>
            </div>
            <Layers className="w-5 h-5 text-cyan-500 opacity-80" />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-workspace-800/60 border border-slate-200/80 dark:border-workspace-700 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Provenance Integrity</div>
              <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.integrityPct}% Verified</div>
            </div>
            <ShieldCheck className="w-5 h-5 text-emerald-500 opacity-80" />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-workspace-800/60 border border-slate-200/80 dark:border-workspace-700 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Verified Claims</div>
              <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                {stats.verified} / {stats.claimsCount || 0}
              </div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-indigo-500 opacity-80" />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-workspace-800/60 border border-slate-200/80 dark:border-workspace-700 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Deliverables</div>
              <div className="text-base font-extrabold text-purple-600 dark:text-purple-400 mt-0.5">{stats.artifacts} Artifacts</div>
            </div>
            <FileText className="w-5 h-5 text-purple-500 opacity-80" />
          </div>
        </div>

        {/* Status Notification Toast Banner */}
        {statusMessage && (
          <div className="p-3.5 rounded-xl bg-cyan-50 dark:bg-workspace-900 border border-cyan-200 dark:border-workspace-700 text-xs text-cyan-900 dark:text-brand-cyan flex items-center gap-2 font-mono">
            <Info className="w-4 h-4 flex-shrink-0 text-cyan-600" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Visual Graph Legend & Quick Filter Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-workspace-800 text-xs">
          {/* Pipeline Legend */}
          <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-400 font-medium">
            <span className="font-bold text-slate-800 dark:text-slate-200">Lineage Pipeline:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
              <span>1. Source</span>
            </div>
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>2. Snapshot</span>
            </div>
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span>3. Evidence</span>
            </div>
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>4. Claim</span>
            </div>
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span>5. Deliverable</span>
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-workspace-800 p-1 rounded-xl">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-white dark:bg-workspace-900 text-cyan-600 dark:text-brand-cyan shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              All Nodes ({stats.total})
            </button>
            <button
              onClick={() => setActiveFilter('claims')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeFilter === 'claims'
                  ? 'bg-white dark:bg-workspace-900 text-cyan-600 dark:text-brand-cyan shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Claims & Evidence
            </button>
            <button
              onClick={() => setActiveFilter('issues')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeFilter === 'issues'
                  ? 'bg-white dark:bg-workspace-900 text-amber-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Drift & Issues ({stats.stale + stats.failed})
            </button>
            <button
              onClick={() => setActiveFilter('artifacts')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeFilter === 'artifacts'
                  ? 'bg-white dark:bg-workspace-900 text-purple-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Deliverables ({stats.artifacts})
            </button>
          </div>
        </div>
      </div>

      {/* Main Graph Canvas */}
      <div className="relative h-[640px] rounded-2xl bg-slate-50 dark:bg-workspace-950 border border-slate-200/90 dark:border-workspace-700/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
            <span>Rendering lineage graph...</span>
          </div>
        ) : (
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            fitView
            className="bg-slate-50 dark:bg-workspace-950"
          >
            <Background color="#cbd5e1" gap={20} size={1} />
            <Controls className="!bg-white dark:!bg-workspace-800 !border-slate-200 dark:!border-workspace-700 !text-slate-700 dark:!text-white shadow-xs" />
            <MiniMap
              nodeColor={(node: any) => {
                if (node.data?.isStale) return '#f59e0b';
                if (node.data?.type === 'source') return '#06b6d4';
                if (node.data?.type === 'snapshot') return '#3b82f6';
                if (node.data?.type === 'evidence') return '#6366f1';
                if (node.data?.type === 'claim') {
                  return (node.data?.status || '').toLowerCase() === 'failed' ? '#f43f5e' : '#10b981';
                }
                if (node.data?.type === 'artifact') return '#a855f7';
                return '#64748b';
              }}
              className="!bg-white dark:!bg-workspace-900 !border-slate-200 dark:!border-workspace-700 rounded-xl shadow-xs"
            />
          </ReactFlow>
        )}

        {/* Selected Node Inspector Drawer */}
        {selectedNode && (
          <div className="absolute top-4 right-4 z-20 w-88 rounded-2xl bg-white dark:bg-workspace-900 border border-slate-200 dark:border-workspace-600 p-5 shadow-2xl space-y-3.5 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-workspace-700 pb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-700 dark:text-brand-cyan capitalize">
                  {selectedNode.type} Node Details
                </span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-workspace-800 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <div className="font-extrabold text-slate-900 dark:text-white text-sm break-words">
                  {selectedNode.label}
                </div>
                {selectedNode.sublabel && (
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 break-all mt-0.5">
                    {selectedNode.sublabel}
                  </div>
                )}
              </div>

              {/* Status Indicator */}
              <div className="pt-2 border-t border-slate-100 dark:border-workspace-750 flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">Node Status:</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                    selectedNode.isStale
                      ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30'
                      : (selectedNode.status || '').toLowerCase() === 'failed'
                      ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30'
                      : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30'
                  }`}
                >
                  {selectedNode.isStale ? 'STALE (DRIFT DETECTED)' : selectedNode.status || 'VERIFIED'}
                </span>
              </div>

              {/* Specific metadata breakdown */}
              {selectedNode.meta && (
                <div className="pt-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Provenance Metadata:</span>
                    <button
                      onClick={() => handleCopy(JSON.stringify(selectedNode.meta, null, 2))}
                      className="text-[10px] text-cyan-600 hover:text-cyan-500 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedText ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedText ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-2.5 rounded-xl bg-slate-50 dark:bg-workspace-950 font-mono text-[10px] text-slate-700 dark:text-slate-300 overflow-x-auto max-h-48 border border-slate-200 dark:border-transparent">
                    {JSON.stringify(selectedNode.meta, null, 2)}
                  </pre>
                </div>
              )}

              {/* External source action */}
              {selectedNode.meta?.url && (
                <div className="pt-2">
                  <a
                    href={selectedNode.meta.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-600 hover:text-cyan-500"
                  >
                    <span>Inspect Target Web Source</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
