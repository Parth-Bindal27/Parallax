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
  Info
} from 'lucide-react';
import { api } from '../api/client.js';
import type { SourceDriftReport } from '@parallax/shared';

// Custom Node Component for React Flow
function CustomLineageNode({ data }: { data: any }) {
  const isStale = data.isStale;
  const type = data.type;

  let borderColor = 'border-workspace-600';
  let badgeColor = 'bg-slate-700 text-slate-300';
  let icon = <Layers className="w-3.5 h-3.5" />;

  if (type === 'source') {
    borderColor = 'border-brand-cyan';
    badgeColor = 'bg-cyan-500/20 text-cyan-300';
    icon = <Globe className="w-3.5 h-3.5 text-brand-cyan" />;
  } else if (type === 'snapshot') {
    borderColor = 'border-blue-400';
    badgeColor = 'bg-blue-500/20 text-blue-300';
    icon = <Camera className="w-3.5 h-3.5 text-blue-400" />;
  } else if (type === 'evidence') {
    borderColor = 'border-indigo-400';
    badgeColor = 'bg-indigo-500/20 text-indigo-300';
    icon = <Quote className="w-3.5 h-3.5 text-indigo-400" />;
  } else if (type === 'claim') {
    borderColor = isStale ? 'border-amber-400' : 'border-emerald-400';
    badgeColor = isStale ? 'bg-amber-500/20 text-amber-300 animate-pulse' : 'bg-emerald-500/20 text-emerald-300';
    icon = isStale ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  } else if (type === 'artifact') {
    borderColor = 'border-purple-400';
    badgeColor = 'bg-purple-500/20 text-purple-300';
    icon = <FileText className="w-3.5 h-3.5 text-purple-400" />;
  }

  return (
    <div
      className={`px-4 py-3 rounded-xl bg-workspace-900 border-2 shadow-lg transition-all min-w-[180px] max-w-[240px] ${borderColor} ${
        isStale ? 'ring-2 ring-amber-400/50 shadow-amber-500/20 glow-stale' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 !bg-brand-cyan" />
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
          {icon}
          <span className="capitalize">{type}</span>
        </span>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${badgeColor}`}>
          {isStale ? 'STALE' : data.status || 'OK'}
        </span>
      </div>
      <div className="text-xs font-semibold text-slate-100 truncate">{data.label}</div>
      {data.sublabel && (
        <div className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">{data.sublabel}</div>
      )}
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 !bg-brand-cyan" />
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
      setStatusMessage(`Controlled drift triggered: ${data.result.affectedTool} price changed from ₹${data.result.oldPrice} to ₹${data.result.newPrice}. Now run Check Drift.`);
      queryClient.invalidateQueries({ queryKey: ['health'] });
    }
  });

  // Reset Fixture mutation
  const resetFixtureMutation = useMutation({
    mutationFn: () => api.resetFixture(),
    onSuccess: () => {
      setStatusMessage('Fixture reset to baseline state.');
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
        setStatusMessage(`Source drift confirmed! ${data.report.staleClaimIds.length} stale claim(s) identified.`);
      } else {
        setStatusMessage('No drift detected. Baseline content is intact.');
      }
    }
  });

  // Selective Revalidation mutation
  const revalidateMutation = useMutation({
    mutationFn: (driftReportId: string) => api.revalidateDrift(missionId!, driftReportId),
    onSuccess: (data) => {
      setDriftResult(null);
      setStatusMessage(`Selective revalidation complete! Claim updated to ₹${data.updatedClaims[0]?.value} and artifacts regenerated.`);
      refetchLineage();
      queryClient.invalidateQueries({ queryKey: ['mission', missionId] });
      queryClient.invalidateQueries({ queryKey: ['claims', missionId] });
      queryClient.invalidateQueries({ queryKey: ['verification', missionId] });
    }
  });

  // Convert graph data into React Flow nodes and edges with layered layout
  const { flowNodes, flowEdges } = useMemo(() => {
    if (!lineageData?.graph) return { flowNodes: [], flowEdges: [] };

    const rawNodes = lineageData.graph.nodes;
    const rawEdges = lineageData.graph.edges;

    // Layout nodes into clean columns by type
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
        stroke: e.isStale ? '#f59e0b' : '#384b70',
        strokeWidth: e.isStale ? 2.5 : 1.5
      }
    }));

    return { flowNodes: nodes, flowEdges: edges };
  }, [lineageData]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node.data);
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Header & Interactive Drift Sandbox Controls */}
      <div className="glass-panel rounded-xl p-6 border border-workspace-700/80 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
              <GitBranch className="w-6 h-6 text-brand-cyan" />
              <span>Evidence Lineage & Drift Map</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Cryptographically auditable dependency graph tracing sources, snapshots, quotations, claims, and deliverables
            </p>
          </div>

          {/* Demonstration Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => mutateFixtureMutation.mutate()}
              disabled={mutateFixtureMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-all cursor-pointer"
              title="Mutate local fixture price from ₹499 to ₹699 to demonstrate controlled drift"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>1. Mutate Fixture (Drift)</span>
            </button>

            <button
              onClick={() => checkDriftMutation.mutate()}
              disabled={checkDriftMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkDriftMutation.isPending ? 'animate-spin' : ''}`} />
              <span>2. Check Source Drift</span>
            </button>

            {driftResult?.hasDrift && (
              <button
                onClick={() => revalidateMutation.mutate(driftResult.id)}
                disabled={revalidateMutation.isPending}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer animate-pulse"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>3. Selective Revalidate</span>
              </button>
            )}

            <button
              onClick={() => resetFixtureMutation.mutate()}
              className="p-1.5 rounded-lg bg-workspace-800 hover:bg-workspace-700 text-slate-400 hover:text-white border border-workspace-700 text-xs transition-colors cursor-pointer"
              title="Reset fixture to baseline state"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="p-3 rounded-lg bg-workspace-900 border border-workspace-700 text-xs text-brand-cyan flex items-center gap-2 font-mono">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Main Graph Canvas */}
      <div className="relative h-[620px] rounded-2xl glass-panel border border-workspace-700/80 shadow-2xl overflow-hidden">
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
            className="bg-workspace-950"
          >
            <Background color="#162038" gap={20} size={1} />
            <Controls className="!bg-workspace-800 !border-workspace-700 !text-white" />
            <MiniMap
              nodeColor={(node: any) => (node.data.isStale ? '#f59e0b' : '#06b6d4')}
              className="!bg-workspace-900 !border-workspace-700 rounded-lg"
            />
          </ReactFlow>
        )}

        {/* Selected Node Inspector Drawer */}
        {selectedNode && (
          <div className="absolute top-4 right-4 z-20 w-80 rounded-xl glass-panel border border-workspace-600 p-5 shadow-2xl space-y-3 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-workspace-700 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-cyan capitalize">
                {selectedNode.type} Node
              </span>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-workspace-800"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="font-bold text-white text-sm">{selectedNode.label}</div>
              {selectedNode.sublabel && (
                <div className="text-[11px] font-mono text-slate-400">{selectedNode.sublabel}</div>
              )}
              <div className="pt-2 border-t border-workspace-750 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">Node Status:</span>
                <div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                      selectedNode.isStale
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {selectedNode.isStale ? 'STALE (DRIFT DETECTED)' : selectedNode.status || 'VERIFIED'}
                  </span>
                </div>
              </div>

              {selectedNode.meta && (
                <div className="pt-2 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Metadata:</span>
                  <pre className="p-2 rounded bg-workspace-950 font-mono text-[10px] text-slate-300 overflow-x-auto max-h-40">
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
