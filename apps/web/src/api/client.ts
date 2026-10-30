import type {
  Mission,
  MissionNode,
  Source,
  Snapshot,
  EvidenceRecord,
  Claim,
  VerificationRun,
  VerificationCheck,
  Artifact,
  BrowserActionEvent,
  ApprovalRequest,
  SourceDriftReport,
  LineageGraphData,
  AutonomyPolicyLevel,
  GTMCampaignPackage,
  VisionAsset,
  AdaLAuditExecution,
  VideoCapabilityStatus
} from '@parallax/shared';

const API_BASE = '/api/v1';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(endpoint, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    ...options
  });

  if (!res.ok) {
    let errorDetail = `HTTP Error ${res.status}: ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.error) errorDetail = body.error;
    } catch {}
    throw new Error(errorDetail);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Health & System
  async getHealth() {
    return request<{
      status: string;
      version: string;
      database: string;
      provider: { name: string; isAvailable: boolean; mode: string };
      fixtureMutated: boolean;
    }>('/health');
  },

  async getSettings() {
    return request<{
      environment: string;
      port: number;
      provider: { name: string; isAvailable: boolean; mode: string };
      defaultAutonomyLevel: string;
      allowLocalFixtures: boolean;
      ssrfProtectionEnabled: boolean;
      databasePath: string;
      snapshotsPath: string;
      artifactsPath: string;
    }>(`${API_BASE}/settings`);
  },

  // Fixtures
  async mutateFixture(mutationType: 'price_increase' | 'feature_removal' | 'terms_update' = 'price_increase') {
    return request<{ success: boolean; result: any }>(`${API_BASE}/fixtures/mutate`, {
      method: 'POST',
      body: JSON.stringify({ mutationType })
    });
  },

  async resetFixture() {
    return request<{ success: boolean; message: string }>(`${API_BASE}/fixtures/reset`, {
      method: 'POST'
    });
  },

  // Missions
  async createMission(data: { prompt: string; title?: string; autonomyLevel?: AutonomyPolicyLevel; targetUrls?: string[] }) {
    return request<{ mission: Mission; nodes: MissionNode[] }>(`${API_BASE}/missions`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async listMissions() {
    return request<{ missions: Mission[] }>(`${API_BASE}/missions`);
  },

  async getMission(id: string) {
    return request<{ mission: Mission; nodes: MissionNode[] }>(`${API_BASE}/missions/${id}`);
  },

  async startMission(id: string) {
    return request<{ success: boolean; message: string; missionId: string }>(`${API_BASE}/missions/${id}/start`, {
      method: 'POST'
    });
  },

  async pauseMission(id: string) {
    return request<{ success: boolean; message: string }>(`${API_BASE}/missions/${id}/pause`, {
      method: 'POST'
    });
  },

  async resumeMission(id: string) {
    return request<{ success: boolean; message: string }>(`${API_BASE}/missions/${id}/resume`, {
      method: 'POST'
    });
  },

  async cancelMission(id: string) {
    return request<{ success: boolean; message: string }>(`${API_BASE}/missions/${id}/cancel`, {
      method: 'POST'
    });
  },

  // Observability & Execution Data
  async getBrowserActions(missionId: string) {
    return request<{ actions: BrowserActionEvent[] }>(`${API_BASE}/missions/${missionId}/browser-actions`);
  },

  async getSources(missionId: string) {
    return request<{ sources: Source[] }>(`${API_BASE}/missions/${missionId}/sources`);
  },

  async getSnapshots(missionId: string) {
    return request<{ snapshots: Snapshot[] }>(`${API_BASE}/missions/${missionId}/snapshots`);
  },

  async getEvidence(missionId: string) {
    return request<{ evidence: EvidenceRecord[] }>(`${API_BASE}/missions/${missionId}/evidence`);
  },

  async getClaims(missionId: string) {
    return request<{ claims: Claim[] }>(`${API_BASE}/missions/${missionId}/claims`);
  },

  async getLineageGraph(missionId: string) {
    return request<{ graph: LineageGraphData }>(`${API_BASE}/missions/${missionId}/lineage`);
  },

  async getVerification(missionId: string) {
    return request<{ runs: VerificationRun[]; latestChecks: VerificationCheck[] }>(`${API_BASE}/missions/${missionId}/verification`);
  },

  async reverifyMission(missionId: string) {
    return request<{
      success: boolean;
      run: VerificationRun;
      graph: LineageGraphData;
    }>(`${API_BASE}/missions/${missionId}/reverify`, {
      method: 'POST'
    });
  },

  async getArtifacts(missionId: string) {
    return request<{ artifacts: Artifact[] }>(`${API_BASE}/missions/${missionId}/artifacts`);
  },

  // Drift & Revalidation
  async checkDrift(missionId: string, sourceId?: string) {
    return request<{ report: SourceDriftReport }>(`${API_BASE}/missions/${missionId}/drift/check`, {
      method: 'POST',
      body: JSON.stringify({ sourceId })
    });
  },

  async revalidateDrift(missionId: string, driftReportId: string) {
    return request<{
      success: boolean;
      driftReport: SourceDriftReport;
      updatedClaims: Claim[];
      newRun: VerificationRun;
      newArtifacts: Artifact[];
    }>(`${API_BASE}/missions/${missionId}/drift/revalidate`, {
      method: 'POST',
      body: JSON.stringify({ driftReportId })
    });
  },

  // Approvals
  async getApprovals(missionId: string) {
    return request<{ approvals: ApprovalRequest[] }>(`${API_BASE}/approvals?missionId=${missionId}`);
  },

  async resolveApproval(approvalId: string, decision: 'approve' | 'deny', reason?: string, formData?: Record<string, string>) {
    return request<{ success: boolean; approvalId: string; status: string }>(`${API_BASE}/approvals/${approvalId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason, formData })
    });
  },

  async simulateApproval(missionId: string, details?: { actionType?: string; target?: string; reason?: string; riskLevel?: 'low' | 'medium' | 'high' | 'critical' }) {
    return request<{ success: boolean; approval: ApprovalRequest }>(`${API_BASE}/missions/${missionId}/simulate-approval`, {
      method: 'POST',
      body: JSON.stringify(details || {})
    });
  },

  async simulateSignInRequired(missionId: string, targetUrl?: string) {
    return request<{ success: boolean; approval: ApprovalRequest }>(`${API_BASE}/missions/${missionId}/simulate-signin`, {
      method: 'POST',
      body: JSON.stringify({ targetUrl })
    });
  },

  async sendManualAction(missionId: string, action: { actionType: string; targetUrl?: string; selector?: string }) {
    return request<{ success: boolean; action: any }>(`${API_BASE}/missions/${missionId}/manual-action`, {
      method: 'POST',
      body: JSON.stringify(action)
    });
  },

  // Multimodal GTM & Creative Studio (Track Pillar 2)
  async getGTMPackage(missionId: string) {
    return request<{ gtm: GTMCampaignPackage }>(`${API_BASE}/missions/${missionId}/gtm`);
  },

  async generateImage(data: {
    missionId: string;
    title: string;
    headline: string;
    subheadline: string;
    callToAction: string;
    accentColor?: string;
    dimensions?: string;
    assetType?: string;
  }) {
    return request<{ success: boolean; artifact: Artifact; assetSpec: any }>(`${API_BASE}/multimodal/generate-image`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async generateAudio(data: {
    missionId: string;
    title: string;
    scriptText: string;
    durationSeconds?: number;
  }) {
    return request<{ success: boolean; artifact: Artifact; audioUrl: string; fileSize: number; hash: string }>(
      `${API_BASE}/multimodal/generate-audio`,
      {
        method: 'POST',
        body: JSON.stringify(data)
      }
    );
  },

  async uploadImage(data: {
    missionId: string;
    filename: string;
    base64Data: string;
    mimeType: string;
  }) {
    return request<{ success: boolean; visionAsset: VisionAsset; artifact: Artifact }>(
      `${API_BASE}/multimodal/upload-image`,
      {
        method: 'POST',
        body: JSON.stringify(data)
      }
    );
  },

  async runAdaLAudit(missionId: string) {
    return request<{ success: boolean; audit: AdaLAuditExecution }>(`${API_BASE}/missions/${missionId}/adal-audit`, {
      method: 'POST'
    });
  },

  async getBrowserRecordingStatus(missionId: string) {
    return request<VideoCapabilityStatus>(`${API_BASE}/missions/${missionId}/browser-recording`);
  }
};

