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
  AlertTriangle,
  FileText,
  RotateCw,
  FlaskConical,
  RefreshCw,
  Layers,
  Sparkles,
  Info,
  ArrowRight
} from 'lucide-react';
import { api } from '../api/client.js';
import type { SourceDriftReport } from '@parallax/shared';

// Custom Node Component for React Flow
function CustomLineageNode({ data }: { data: any }) {
  const isStale = data.isStale;
  const type = data.type;

  let borderColor = 'border-slate-300 dark:border-workspace-600';
  let badgeColor = 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
  let icon = <Layers className="w-3.5 h-3.5" />;

  if (type === 'source') {
    borderColor = 'border-cyan-400 dark:border-brand-cyan';
    badgeColor = 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300';
    icon = <Globe className="w-3.5 h-3.5 text-cyan-600 dark:text-brand-cyan" />;
  } else if (type === 'snapshot') {
    borderColor = 'border-blue-400';
    badgeColor = 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300';
    icon = <Camera className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
  } else if (type === 'evidence') {
    borderColor = 'border-indigo-400';
    badgeColor = 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300';
    icon = <Quote className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />;
  } else if (type === 'claim') {
    borderColor = isStale ? 'border-amber-500 dark:border-amber-400' : 'border-emerald-500 dark:border-emerald-400';
    badgeColor = isStale ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 animate-pulse' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300';
    icon = isStale ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
  } else if (type === 'artifact') {
    borderColor = 'border-purple-400';
    badgeColor = 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300';
    icon = <FileText className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
  }

  return (
    <div
      className={`px-4 py-3 rounded-xl bg-white dark:bg-workspace-900 border-2 shadow-sm transition-all min-w-[190px] max-w-[240px] cursor-pointer hover:shadow-md ${borderColor} ${
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
      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{data.label}</div>
      {data.sublabel && (
        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-mono">{data.sublabel}</div>
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

  // Fetch Lineage Data
  const { data: lineageData, isLoading, refetch: refetchLineage } = useQuery({
    queryKey: ['lineage', missionId],
    queryFn: () => (missionId ? api.getLineageGraph(missionId) : null),
    enabled: !!missionId
  });

  // Mutate Fixture mutation
  const mutateFixtureMutation = useMutation({
    mutationFn: () => api.mutateFixture('price_increase'),
    onSuccess: (data) => {
      setStatusMessage(`Controlled drift triggered: ${data.result.affectedTool} price changed from ₹${data.result.oldPrice} to ₹${data.result.newPrice}. Click "2. Check Source Drift" to see the graph update.`);
      queryClient.invalidateQueries({ queryKey: ['health'] });
    }
  });

  // Reset Fixture mutation
  const resetFixtureMutation = useMutation({
    mutationFn: () => api.resetFixture(),
    onSuccess: () => {
      setStatusMessage('Fixture successfully reset to baseline state.');
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
        setStatusMessage(`Source drift confirmed! ${data.report.staleClaimIds.length} claim(s) invalidated. Notice the orange STALE nodes! Now click "3. Selective Revalidate" to fix it.`);
      } else {
        setStatusMessage('No drift detected. Baseline content matches exactly.');
      }
    }
  });

  // Selective Revalidation mutation
  const revalidateMutation = useMutation({
    mutationFn: (driftReportId: string) => api.revalidateDrift(missionId!, driftReportId),
    onSuccess: (data) => {
      setDriftResult(null);
      setStatusMessage(`Selective revalidation complete! Claim updated to ₹${data.updatedClaims[0]?.value} and deliverable artifacts regenerated.`);
      refetchLineage();
      queryClient.invalidateQueries({ queryKey: ['mission', missionId] });
      queryClient.invalidateQueries({ queryKey: ['claims', missionId] });
      queryClient.invalidateQueries({ queryKey: ['verification', missionId] });
    }
  });

  // Layout nodes into clean columns
  const { flowNodes, flowEdges } = useMemo(() => {
    if (!lineageData?.graph) return { flowNodes: [], flowEdges: [] };

    const rawNodes = lineageData.graph.nodes;
    const rawEdges = lineageData.graph.edges;

    const columnX: Record<string, number> = {
      source: 50,
      snapshot: 320,
      evidence: 600,
      claim: 880,
      artifact: 1180
    };

    const typeCounters: Record<string, number> = {
      source: 0,
      snapshot: 0,
      evidence: 0,
      claim: 0,
      artifact: 0
    };

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

    const edges: Edge[] = rawEdges.map((e) => ({
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
  }, [lineageData]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node.data);
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Interactive Drift Sandbox Controls */}
      <div className="rounded-2xl bg-white dark:bg-workspace-900 p-6 sm:p-7 border border-slate-200/90 dark:border-workspace-700/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <GitBranch className="w-6 h-6 text-cyan-600 dark:text-brand-cyan" />
              <span>Evidence Lineage & Drift Map</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Traceable dependency graph connecting external web sources, cryptographic snapshots, evidence quotes, claims, and final deliverables.
            </p>
          </div>

          {/* Interactive Drift Test Step-by-Step Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => mutateFixtureMutation.mutate()}
              disabled={mutateFixtureMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/20 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="Step 1: Simulate a website price change (StudyPilot AI ₹499 -> ₹699)"
            >
              <FlaskConical className="w-3.5 h-3.5 text-amber-600" />
              <span>1. Simulate Price Change</span>
            </button>

            <button
              onClick={() => checkDriftMutation.mutate()}
              disabled={checkDriftMutation.isPending}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-50 dark:bg-cyan-500/20 hover:bg-cyan-100 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="Step 2: Check for source drift"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-600 ${checkDriftMutation.isPending ? 'animate-spin' : ''}`} />
              <span>2. Check Source Drift</span>
            </button>

            {driftResult?.hasDrift && (
              <button
                onClick={() => revalidateMutation.mutate(driftResult.id)}
                disabled={revalidateMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer animate-pulse"
                title="Step 3: Update only the invalidated claims without re-running the whole mission"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>3. Selective Revalidate</span>
              </button>
            )}

            <button
              onClick={() => resetFixtureMutation.mutate()}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-workspace-800 dark:hover:bg-workspace-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-workspace-700 text-xs transition-colors cursor-pointer"
              title="Reset fixture back to default baseline"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Visual Graph Legend / Flow Explanation */}
        <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-100 dark:border-workspace-800 text-xs text-slate-600 dark:text-slate-400 font-medium">
          <span className="font-bold text-slate-800 dark:text-slate-200">Lineage Pipeline:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
            <span>1. Web Source</span>
          </div>
          <ArrowRight className="w-3 h-3 text-slate-400" />
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>2. DOM Snapshot</span>
          </div>
          <ArrowRight className="w-3 h-3 text-slate-400" />
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span>3. Evidence Excerpt</span>
          </div>
          <ArrowRight className="w-3 h-3 text-slate-400" />
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>4. Verified Claim</span>
          </div>
          <ArrowRight className="w-3 h-3 text-slate-400" />
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span>5. Deliverable File</span>
          </div>
        </div>

        {statusMessage && (
          <div className="p-3.5 rounded-xl bg-cyan-50 dark:bg-workspace-900 border border-cyan-200 dark:border-workspace-700 text-xs text-cyan-900 dark:text-brand-cyan flex items-center gap-2 font-mono">
            <Info className="w-4 h-4 flex-shrink-0 text-cyan-600" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Main Graph Canvas */}
      <div className="relative h-[620px] rounded-2xl bg-slate-50 dark:bg-workspace-950 border border-slate-200/90 dark:border-workspace-700/80 shadow-sm overflow-hidden">
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
              nodeColor={(node: any) => (node.data.isStale ? '#f59e0b' : '#06b6d4')}
              className="!bg-white dark:!bg-workspace-900 !border-slate-200 dark:!border-workspace-700 rounded-xl shadow-xs"
            />
          </ReactFlow>
        )}

        {/* Selected Node Inspector Drawer */}
        {selectedNode && (
          <div className="absolute top-4 right-4 z-20 w-84 rounded-2xl bg-white dark:bg-workspace-900 border border-slate-200 dark:border-workspace-600 p-5 shadow-xl space-y-3 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-workspace-700 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-brand-cyan capitalize">
                {selectedNode.type} Node Details
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-workspace-800 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-slate-900 dark:text-white text-sm">{selectedNode.label}</div>
              {selectedNode.sublabel && (
                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{selectedNode.sublabel}</div>
              )}
              <div className="pt-2 border-t border-slate-100 dark:border-workspace-750 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Node Status:</span>
                <div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                      selectedNode.isStale
                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30'
                        : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30'
                    }`}
                  >
                    {selectedNode.isStale ? 'STALE (DRIFT DETECTED)' : selectedNode.status || 'VERIFIED'}
                  </span>
                </div>
              </div>

              {selectedNode.meta && (
                <div className="pt-2 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Metadata:</span>
                  <pre className="p-2.5 rounded-xl bg-slate-50 dark:bg-workspace-950 font-mono text-[10px] text-slate-700 dark:text-slate-300 overflow-x-auto max-h-40 border border-slate-200 dark:border-transparent">
                    {JSON.stringify(selectedNode.meta, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
