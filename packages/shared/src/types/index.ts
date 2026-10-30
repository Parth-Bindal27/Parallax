export type VerificationStatus = 'PASS' | 'FAIL' | 'UNCERTAIN' | 'UNPROVABLE';

export type ClaimLifecycleState =
  | 'pending'
  | 'verified'
  | 'stale'
  | 'contradicted'
  | 'failed'
  | 'unverifiable';

export type MissionStatus =
  | 'draft'
  | 'planning'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'awaiting_approval';

export type AutonomyPolicyLevel =
  | 'READ_ONLY_RESEARCH'
  | 'INTERACTIVE_NAVIGATION'
  | 'FORM_INTERACTION'
  | 'HIGH_IMPACT_ACTIONS';

export type MissionNodeType =
  | 'DISCOVER_SOURCES'
  | 'VISIT_SOURCE'
  | 'CAPTURE_SNAPSHOT'
  | 'EXTRACT_CLAIMS'
  | 'VERIFY_CLAIMS'
  | 'GENERATE_ARTIFACTS'
  | 'VALIDATE_ARTIFACTS'
  | 'FINAL_VERDICT';

export type NodeStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'stale';

export type DependencyEdgeType =
  | 'SOURCE_TO_SNAPSHOT'
  | 'SNAPSHOT_TO_EVIDENCE'
  | 'EVIDENCE_TO_CLAIM'
  | 'CLAIM_TO_CHECK'
  | 'CLAIM_TO_CSV_CELL'
  | 'CLAIM_TO_REPORT_SECTION'
  | 'ARTIFACT_TO_VALIDATION'
  | 'SOURCE_VERSION_TO_CLAIM';

export type BrowserActionType =
  | 'NAVIGATE'
  | 'READ_PAGE'
  | 'EXTRACT_TEXT'
  | 'INSPECT_LINKS'
  | 'LOCATE_ELEMENT'
  | 'CLICK'
  | 'FILL'
  | 'SCROLL'
  | 'SCREENSHOT'
  | 'SNAPSHOT';

export type BrowserActionResultStatus =
  | 'performed'
  | 'skipped'
  | 'cancelled'
  | 'blocked'
  | 'failed';

export type ArtifactType = 'CSV' | 'MARKDOWN' | 'JSON' | 'HTML' | 'IMAGE' | 'AUDIO' | 'VIDEO';

export interface MissionSpecification {
  objective: string;
  requiredInputs: string[];
  expectedOutputs: ArtifactType[];
  constraints: string[];
  researchTargets: string[];
  sourceRequirements: string[];
  extractionFields: {
    name: string;
    description: string;
    dataType: 'string' | 'number' | 'boolean' | 'url' | 'currency';
    required: boolean;
  }[];
  verificationRules: {
    ruleId: string;
    description: string;
    severity: 'critical' | 'warning';
  }[];
  artifactRequirements: {
    type: ArtifactType;
    filename: string;
  }[];
  dependencies: string[];
  completionCriteria: string[];
  approvalRequirements: {
    actionType: string;
    threshold: string;
  }[];
  failureHandlingPolicy: 'abort_mission' | 'isolate_and_continue';
}

export interface Mission {
  id: string;
  title: string;
  rawPrompt: string;
  status: MissionStatus;
  autonomyLevel: AutonomyPolicyLevel;
  spec: MissionSpecification;
  verdict: VerificationStatus | null;
  summary: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface MissionNode {
  id: string;
  missionId: string;
  nodeType: MissionNodeType;
  label: string;
  description: string;
  status: NodeStatus;
  dependencies: string[]; // parent node IDs
  payload: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  retries: number;
  maxRetries: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface Source {
  id: string;
  missionId: string;
  url: string;
  canonicalUrl: string;
  domain: string;
  title: string | null;
  isPermitted: boolean;
  isAccessible: boolean;
  firstDiscoveredAt: string;
  lastCheckedAt: string;
}

export interface Snapshot {
  id: string;
  sourceId: string;
  missionId: string;
  version: number;
  captureTime: string;
  contentHash: string; // SHA-256 of normalized text
  rawStoragePath: string | null;
  normalizedText: string;
  title: string;
  statusCode: number;
  headers: Record<string, string>;
  previousSnapshotId: string | null;
  hasChangedFromPrevious: boolean;
}

export interface EvidenceRecord {
  id: string;
  missionId: string;
  sourceId: string;
  snapshotId: string;
  exactExcerpt: string;
  surroundingContext: string;
  locator: {
    selector?: string;
    headingPath?: string[];
    charOffset?: number;
    textLength?: number;
  };
  evidenceType: 'quotation' | 'table_cell' | 'metadata' | 'screenshot_ocr';
  contentFingerprint: string;
  url: string;
  pageTitle: string;
  validationStatus: VerificationStatus;
  isContradicted: boolean;
  retrievalTimestamp: string;
  lastValidatedTimestamp: string;
}

export interface Claim {
  id: string;
  missionId: string;
  subject: string; // e.g. "StudyPilot AI"
  predicate: string; // e.g. "monthlyPrice"
  value: string | number | boolean | null;
  dataType: 'string' | 'number' | 'boolean' | 'url' | 'currency';
  unitOrCurrency: string | null;
  billingPeriod: string | null;
  supportingEvidenceIds: string[];
  contradictoryEvidenceIds: string[];
  confidence: number;
  verificationStatus: ClaimLifecycleState;
  extractedAt: string;
  lastVerifiedAt: string | null;
  notes: string | null;
}

export interface DependencyEdge {
  id: string;
  missionId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: DependencyEdgeType;
  isStale: boolean;
  createdAt: string;
}

export interface VerificationCheck {
  id: string;
  missionId: string;
  runId: string;
  ruleId: string;
  name: string;
  status: VerificationStatus;
  reason: string;
  claimId: string | null;
  evidenceId: string | null;
  expectedValue: string | null;
  actualValue: string | null;
  remediation: string | null;
  checkedAt: string;
}

export interface VerificationRun {
  id: string;
  missionId: string;
  verdict: VerificationStatus;
  passCount: number;
  failCount: number;
  uncertainCount: number;
  unprovableCount: number;
  totalChecks: number;
  summary: string;
  createdAt: string;
}

export interface Artifact {
  id: string;
  missionId: string;
  artifactType: ArtifactType;
  filename: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  hash: string;
  version: number;
  isValidated: boolean;
  validationErrors: string[];
  createdAt: string;
}

export interface BrowserActionEvent {
  actionId: string;
  missionId: string;
  actionType: BrowserActionType;
  url: string;
  selector?: string;
  inputValue?: string;
  startTime: string;
  completionTime: string;
  status: BrowserActionResultStatus;
  error?: string;
  screenshotPath?: string;
  sourceId?: string;
  evidenceId?: string;
}

export interface ApprovalRequest {
  id: string;
  missionId: string;
  actionType: string;
  target: string;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'denied';
  requestedAt: string;
  resolvedAt: string | null;
  resolvedBy?: string;
}

export interface SourceDriftReport {
  id: string;
  missionId: string;
  sourceId: string;
  oldSnapshotId: string;
  newSnapshotId: string;
  detectedAt: string;
  hasDrift: boolean;
  lineDiff: {
    added: string[];
    removed: string[];
  };
  fieldChanges: {
    subject: string;
    predicate: string;
    oldValue: string | null;
    newValue: string | null;
  }[];
  staleClaimIds: string[];
  staleEvidenceIds: string[];
  affectedChecks: string[];
  affectedArtifacts: string[];
  revalidationStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface LineageGraphData {
  nodes: {
    id: string;
    type: 'source' | 'snapshot' | 'evidence' | 'claim' | 'check' | 'artifact' | 'csv_cell' | 'report_section';
    label: string;
    sublabel?: string;
    status: string;
    isStale: boolean;
    data: Record<string, unknown>;
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    edgeType: DependencyEdgeType;
    label?: string;
    isStale: boolean;
  }[];
}

export interface BattlecardEntry {
  competitor: string;
  monthlyPrice: string;
  freeTier: string;
  coreStrength: string;
  vulnerability: string;
  verifiedEvidenceQuote: string;
  evidenceId: string;
}

export interface CreativeAssetSpec {
  id: string;
  type: 'social_banner' | 'comparison_card' | 'feature_spotlight';
  title: string;
  headline: string;
  subheadline: string;
  callToAction: string;
  accentColor: string;
  verifiedStats: { label: string; value: string }[];
  generatedImageUrl?: string;
  generatedImageFormat?: string;
  generatedImageSize?: number;
  generatedImageHash?: string;
  generationProvider?: string;
}

export interface VisionAsset {
  id: string;
  missionId: string;
  filename: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
  sha256Hash: string;
  extractedText?: string;
  visualClaims?: string[];
  uploadedAt: string;
}

export interface VideoCapabilityStatus {
  status: 'FUTURE_CAPABILITY' | 'AVAILABLE';
  supportedProviders: string[];
  browserSessionRecordingAvailable: boolean;
  browserRecordingUrl?: string;
  configurationRequirement: string;
}

export interface AdaLAuditExecution {
  status: 'PASS' | 'FAIL';
  executedAt: string;
  fidelityScore: number;
  componentsTested: string[];
  assertions: {
    name: string;
    target: string;
    status: 'PASS' | 'FAIL';
    details: string;
  }[];
  traceLog: string;
}

export interface GTMCampaignPackage {
  missionId: string;
  generatedAt: string;
  productName: string;
  targetAudience: {
    segment: string;
    painPoint: string;
    strategicHook: string;
  }[];
  battlecard: BattlecardEntry[];
  positioning: {
    elevatorPitch: string;
    keyDifferentiators: string[];
    objectionHandling: { objection: string; counterPitch: string; verifiedProof: string }[];
  };
  creativeAssets: CreativeAssetSpec[];
  audioVoiceoverScript: {
    durationSeconds: number;
    title: string;
    sections: { timestamp: string; speaker: string; text: string; soundEffect?: string }[];
    generatedAudioUrl?: string;
    generatedAudioFormat?: string;
    generatedAudioSize?: number;
    generatedAudioHash?: string;
    audioProvider?: string;
  };
  launchChannels: {
    channel: string;
    postCopy: string;
    hashtags: string[];
  }[];
  visionAssets?: VisionAsset[];
  videoCapabilityStatus?: VideoCapabilityStatus;
  adalAuditExecution?: AdaLAuditExecution;
  adalFidelityScore: number;
  adalAuditSummary: string;
}
