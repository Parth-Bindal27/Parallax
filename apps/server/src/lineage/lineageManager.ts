import { v4 as uuidv4 } from 'uuid';
import type {
  DependencyEdge,
  DependencyEdgeType,
  LineageGraphData
} from '@parallax/shared';
import { repo } from '../database/repository.js';
import { logger } from '../observability/logger.js';

export interface ImpactAnalysisResult {
  staleEvidenceIds: string[];
  staleClaimIds: string[];
  affectedChecks: string[];
  affectedArtifacts: string[];
}

export class LineageManager {
  /**
   * Adds dependency edges between nodes
   */
  addEdge(missionId: string, sourceNodeId: string, targetNodeId: string, edgeType: DependencyEdgeType): DependencyEdge {
    const edge: DependencyEdge = {
      id: uuidv4(),
      missionId,
      sourceNodeId,
      targetNodeId,
      edgeType,
      isStale: false,
      createdAt: new Date().toISOString()
    };
    repo.createDependencyEdges([edge]);
    return edge;
  }

  addBatchEdges(missionId: string, edgeDefinitions: { sourceNodeId: string; targetNodeId: string; edgeType: DependencyEdgeType }[]): DependencyEdge[] {
    const edges: DependencyEdge[] = edgeDefinitions.map(def => ({
      id: uuidv4(),
      missionId,
      sourceNodeId: def.sourceNodeId,
      targetNodeId: def.targetNodeId,
      edgeType: def.edgeType,
      isStale: false,
      createdAt: new Date().toISOString()
    }));
    repo.createDependencyEdges(edges);
    return edges;
  }

  /**
   * Computes downstream impact when a source snapshot or evidence changes
   */
  computeDownstreamImpact(missionId: string, changedSnapshotId: string, invalidatedEvidenceIds: string[]): ImpactAnalysisResult {
    const allEdges = repo.getDependencyEdges(missionId);
    const staleEvidenceIds = new Set<string>(invalidatedEvidenceIds);
    const staleClaimIds = new Set<string>();
    const affectedChecks = new Set<string>();
    const affectedArtifacts = new Set<string>();

    // 1. Snapshot -> Evidence
    for (const edge of allEdges) {
      if (edge.edgeType === 'SNAPSHOT_TO_EVIDENCE' && edge.sourceNodeId === changedSnapshotId) {
        staleEvidenceIds.add(edge.targetNodeId);
      }
    }

    // 2. Evidence -> Claim
    for (const edge of allEdges) {
      if (edge.edgeType === 'EVIDENCE_TO_CLAIM' && staleEvidenceIds.has(edge.sourceNodeId)) {
        staleClaimIds.add(edge.targetNodeId);
      }
    }

    // 3. Claim -> Check, CSV Cell, Report Section
    for (const edge of allEdges) {
      if (staleClaimIds.has(edge.sourceNodeId)) {
        if (edge.edgeType === 'CLAIM_TO_CHECK') {
          affectedChecks.add(edge.targetNodeId);
        } else if (edge.edgeType === 'CLAIM_TO_CSV_CELL' || edge.edgeType === 'CLAIM_TO_REPORT_SECTION') {
          affectedArtifacts.add(edge.targetNodeId);
        }
      }
    }

    // Mark affected edges as stale in repository
    const targetNodeIds = [
      ...Array.from(staleEvidenceIds),
      ...Array.from(staleClaimIds),
      ...Array.from(affectedChecks),
      ...Array.from(affectedArtifacts)
    ];
    repo.markEdgesStale(targetNodeIds);

    logger.info(`Lineage impact analysis for snapshot ${changedSnapshotId}: ${staleClaimIds.size} stale claims, ${affectedArtifacts.size} affected outputs`);

    return {
      staleEvidenceIds: Array.from(staleEvidenceIds),
      staleClaimIds: Array.from(staleClaimIds),
      affectedChecks: Array.from(affectedChecks),
      affectedArtifacts: Array.from(affectedArtifacts)
    };
  }

  /**
   * Generates graph nodes and edges suitable for React Flow rendering
   */
  getLineageGraph(missionId: string): LineageGraphData {
    const sources = repo.getSources(missionId);
    const snapshots = repo.getSnapshots(missionId);
    const evidenceList = repo.getEvidenceRecords(missionId);
    const claims = repo.getClaims(missionId);
    const artifacts = repo.getArtifacts(missionId);
    const edges = repo.getDependencyEdges(missionId);

    const graphNodes: LineageGraphData['nodes'] = [];

    // Add Sources
    for (const s of sources) {
      graphNodes.push({
        id: s.id,
        type: 'source',
        label: s.title || s.domain,
        sublabel: s.url,
        status: s.isAccessible ? 'accessible' : 'inaccessible',
        isStale: false,
        data: { url: s.url, domain: s.domain }
      });
    }

    // Add Snapshots
    for (const sn of snapshots) {
      graphNodes.push({
        id: sn.id,
        type: 'snapshot',
        label: `Snapshot v${sn.version}`,
        sublabel: `Hash: ${sn.contentHash.slice(0, 10)}...`,
        status: sn.hasChangedFromPrevious ? 'drifted' : 'baseline',
        isStale: false,
        data: { version: sn.version, hash: sn.contentHash, captureTime: sn.captureTime }
      });
    }

    // Add Evidence
    for (const ev of evidenceList) {
      graphNodes.push({
        id: ev.id,
        type: 'evidence',
        label: `Quote (${ev.exactExcerpt.slice(0, 30)}...)`,
        sublabel: ev.pageTitle,
        status: ev.validationStatus,
        isStale: false,
        data: { excerpt: ev.exactExcerpt, context: ev.surroundingContext, locator: ev.locator }
      });
    }

    // Add Claims
    for (const c of claims) {
      const isStale = c.verificationStatus === 'stale';
      graphNodes.push({
        id: c.id,
        type: 'claim',
        label: `${c.subject}: ${c.predicate}`,
        sublabel: `Value: ${String(c.value)} ${c.unitOrCurrency || ''}`,
        status: c.verificationStatus,
        isStale,
        data: { subject: c.subject, predicate: c.predicate, value: c.value, status: c.verificationStatus }
      });
    }

    // Add Artifacts
    for (const a of artifacts) {
      graphNodes.push({
        id: a.id,
        type: 'artifact',
        label: a.filename,
        sublabel: `${a.artifactType} (v${a.version})`,
        status: a.isValidated ? 'validated' : 'unvalidated',
        isStale: false,
        data: { filename: a.filename, type: a.artifactType, version: a.version }
      });
    }

    const graphEdges: LineageGraphData['edges'] = edges.map(e => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      edgeType: e.edgeType,
      label: e.edgeType.replace(/_/g, ' '),
      isStale: e.isStale
    }));

    return {
      nodes: graphNodes,
      edges: graphEdges
    };
  }
}

export const lineageManager = new LineageManager();
