import type {
  MissionStatus,
  NodeStatus,
  VerificationStatus,
  BrowserActionEvent,
  EvidenceRecord,
  Claim,
  Artifact,
  SourceDriftReport,
  ApprovalRequest
} from '../types/index.js';

export type MissionEventType =
  | 'mission_created'
  | 'plan_compiled'
  | 'node_queued'
  | 'node_started'
  | 'node_completed'
  | 'node_failed'
  | 'browser_action_started'
  | 'browser_action_completed'
  | 'source_captured'
  | 'evidence_created'
  | 'claim_extracted'
  | 'verification_completed'
  | 'source_drift_detected'
  | 'dependency_invalidated'
  | 'artifact_generated'
  | 'approval_requested'
  | 'approval_resolved'
  | 'mission_paused'
  | 'mission_resumed'
  | 'mission_cancelled'
  | 'mission_completed'
  | 'mission_failed'
  | 'model_resuming_browsing'
  | 'model_browsing_completed';

export interface MissionEvent<T = Record<string, unknown>> {
  id: string;
  missionId: string;
  type: MissionEventType;
  timestamp: string;
  payload: T;
}

export type MissionEventPayloadMap = {
  mission_created: { missionId: string; title: string; status: MissionStatus };
  plan_compiled: { missionId: string; totalNodes: number; objective: string };
  node_queued: { nodeId: string; nodeType: string; label: string };
  node_started: { nodeId: string; nodeType: string; label: string };
  node_completed: { nodeId: string; nodeType: string; label: string; status: NodeStatus };
  node_failed: { nodeId: string; nodeType: string; error: string };
  browser_action_started: BrowserActionEvent;
  browser_action_completed: BrowserActionEvent;
  source_captured: { sourceId: string; url: string; title: string; snapshotId: string; contentHash: string };
  evidence_created: { evidence: EvidenceRecord };
  claim_extracted: { claim: Claim };
  verification_completed: { runId: string; verdict: VerificationStatus; passCount: number; failCount: number };
  source_drift_detected: { driftReport: SourceDriftReport };
  dependency_invalidated: { staleClaimIds: string[]; staleEvidenceIds: string[]; affectedArtifacts: string[] };
  artifact_generated: { artifact: Artifact };
  approval_requested: { approval: ApprovalRequest };
  approval_resolved: { approvalId: string; status: 'approved' | 'denied' };
  mission_paused: { missionId: string };
  mission_resumed: { missionId: string };
  mission_cancelled: { missionId: string };
  mission_completed: { missionId: string; verdict: VerificationStatus; summary: string };
  mission_failed: { missionId: string; error: string };
};
