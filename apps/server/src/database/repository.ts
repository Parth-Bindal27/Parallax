import { getDatabase } from './db.js';
import type {
  Mission,
  MissionNode,
  MissionStatus,
  NodeStatus,
  Source,
  Snapshot,
  EvidenceRecord,
  Claim,
  DependencyEdge,
  VerificationRun,
  VerificationCheck,
  Artifact,
  BrowserActionEvent,
  ApprovalRequest,
  SourceDriftReport,
  VerificationStatus,
  ClaimLifecycleState
} from '@parallax/shared';

// Helper to safely parse JSON
function safeParse<T>(jsonStr: string | null | undefined, fallback: T): T {
  if (!jsonStr) return fallback;
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return fallback;
  }
}

export class Repository {
  // --- MISSIONS ---
  createMission(mission: Mission): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO missions (
        id, title, raw_prompt, status, autonomy_level, spec_json, verdict, summary, error, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      mission.id,
      mission.title,
      mission.rawPrompt,
      mission.status,
      mission.autonomyLevel,
      JSON.stringify(mission.spec),
      mission.verdict ?? null,
      mission.summary ?? null,
      mission.error ?? null,
      mission.createdAt,
      mission.updatedAt,
      mission.completedAt ?? null
    );
  }

  getMission(id: string): Mission | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM missions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      id: String(row.id),
      title: String(row.title),
      rawPrompt: String(row.raw_prompt),
      status: row.status as MissionStatus,
      autonomyLevel: row.autonomy_level as any,
      spec: safeParse(row.spec_json as string, {} as any),
      verdict: (row.verdict as VerificationStatus) ?? null,
      summary: (row.summary as string) ?? null,
      error: (row.error as string) ?? null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      completedAt: (row.completed_at as string) ?? null
    };
  }

  listMissions(limit = 50): Mission[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM missions ORDER BY created_at DESC LIMIT ?').all(limit) as Record<string, unknown>[];
    return rows.map(row => ({
      id: String(row.id),
      title: String(row.title),
      rawPrompt: String(row.raw_prompt),
      status: row.status as MissionStatus,
      autonomyLevel: row.autonomy_level as any,
      spec: safeParse(row.spec_json as string, {} as any),
      verdict: (row.verdict as VerificationStatus) ?? null,
      summary: (row.summary as string) ?? null,
      error: (row.error as string) ?? null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      completedAt: (row.completed_at as string) ?? null
    }));
  }

  updateMissionStatus(id: string, status: MissionStatus, verdict?: VerificationStatus | null, summary?: string | null, error?: string | null): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    const completedAt = ['completed', 'failed', 'cancelled'].includes(status) ? now : null;

    const stmt = db.prepare(`
      UPDATE missions 
      SET status = ?, 
          verdict = COALESCE(?, verdict), 
          summary = COALESCE(?, summary), 
          error = COALESCE(?, error), 
          updated_at = ?, 
          completed_at = COALESCE(?, completed_at)
      WHERE id = ?
    `);
    stmt.run(status, verdict ?? null, summary ?? null, error ?? null, now, completedAt, id);
  }

  // --- MISSION NODES ---
  createMissionNodes(nodes: MissionNode[]): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO mission_nodes (
        id, mission_id, node_type, label, description, status, dependencies_json, payload_json, output_json, error, retries, max_retries, started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const node of nodes) {
      stmt.run(
        node.id,
        node.missionId,
        node.nodeType,
        node.label,
        node.description,
        node.status,
        JSON.stringify(node.dependencies),
        JSON.stringify(node.payload),
        node.output ? JSON.stringify(node.output) : null,
        node.error ?? null,
        node.retries,
        node.maxRetries,
        node.startedAt ?? null,
        node.completedAt ?? null
      );
    }
  }

  getMissionNodes(missionId: string): MissionNode[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM mission_nodes WHERE mission_id = ?').all(missionId) as Record<string, unknown>[];
    return rows.map(row => ({
      id: String(row.id),
      missionId: String(row.mission_id),
      nodeType: row.node_type as any,
      label: String(row.label),
      description: String(row.description),
      status: row.status as NodeStatus,
      dependencies: safeParse(row.dependencies_json as string, []),
      payload: safeParse(row.payload_json as string, {}),
      output: row.output_json ? safeParse(row.output_json as string, null) : null,
      error: (row.error as string) ?? null,
      retries: Number(row.retries),
      maxRetries: Number(row.max_retries),
      startedAt: (row.started_at as string) ?? null,
      completedAt: (row.completed_at as string) ?? null
    }));
  }

  updateNodeStatus(id: string, status: NodeStatus, output?: Record<string, unknown> | null, error?: string | null): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    const startedAt = status === 'running' ? now : null;
    const completedAt = ['completed', 'failed', 'skipped'].includes(status) ? now : null;

    const stmt = db.prepare(`
      UPDATE mission_nodes
      SET status = ?,
          output_json = CASE WHEN ? IS NOT NULL THEN ? ELSE output_json END,
          error = ?,
          started_at = CASE WHEN ? IS NOT NULL THEN ? ELSE started_at END,
          completed_at = CASE WHEN ? IS NOT NULL THEN ? ELSE completed_at END
      WHERE id = ?
    `);

    const outputStr = output ? JSON.stringify(output) : null;
    stmt.run(status, outputStr, outputStr, error ?? null, startedAt, startedAt, completedAt, completedAt, id);
  }

  // --- MISSION EVENTS ---
  createMissionEvent(id: string, missionId: string, type: string, payload: Record<string, unknown>, timestamp: string): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO mission_events (id, mission_id, type, timestamp, payload_json)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, missionId, type, timestamp, JSON.stringify(payload));
  }

  getMissionEvents(missionId: string, sinceTimestamp?: string): { id: string; missionId: string; type: string; timestamp: string; payload: Record<string, unknown> }[] {
    const db = getDatabase();
    let query = 'SELECT * FROM mission_events WHERE mission_id = ?';
    const params: (string | number)[] = [missionId];

    if (sinceTimestamp) {
      query += ' AND timestamp > ?';
      params.push(sinceTimestamp);
    }
    query += ' ORDER BY timestamp ASC';

    const rows = db.prepare(query).all(...(params as any[])) as Record<string, unknown>[];
    return rows.map(r => ({
      id: String(r.id),
      missionId: String(r.mission_id),
      type: String(r.type),
      timestamp: String(r.timestamp),
      payload: safeParse(r.payload_json as string, {})
    }));
  }

  // --- SOURCES ---
  createSource(source: Source): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO sources (
        id, mission_id, url, canonical_url, domain, title, is_permitted, is_accessible, first_discovered_at, last_checked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      source.id,
      source.missionId,
      source.url,
      source.canonicalUrl,
      source.domain,
      source.title ?? null,
      source.isPermitted ? 1 : 0,
      source.isAccessible ? 1 : 0,
      source.firstDiscoveredAt,
      source.lastCheckedAt
    );
  }

  getSources(missionId: string): Source[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM sources WHERE mission_id = ?').all(missionId) as Record<string, unknown>[];
    return rows.map(r => ({
      id: String(r.id),
      missionId: String(r.mission_id),
      url: String(r.url),
      canonicalUrl: String(r.canonical_url),
      domain: String(r.domain),
      title: (r.title as string) ?? null,
      isPermitted: Number(r.is_permitted) === 1,
      isAccessible: Number(r.is_accessible) === 1,
      firstDiscoveredAt: String(r.first_discovered_at),
      lastCheckedAt: String(r.last_checked_at)
    }));
  }

  getSourceById(id: string): Source | null {
    const db = getDatabase();
    const r = db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!r) return null;
    return {
      id: String(r.id),
      missionId: String(r.mission_id),
      url: String(r.url),
      canonicalUrl: String(r.canonical_url),
      domain: String(r.domain),
      title: (r.title as string) ?? null,
      isPermitted: Number(r.is_permitted) === 1,
      isAccessible: Number(r.is_accessible) === 1,
      firstDiscoveredAt: String(r.first_discovered_at),
      lastCheckedAt: String(r.last_checked_at)
    };
  }

  // --- SNAPSHOTS ---
  createSnapshot(snapshot: Snapshot): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO snapshots (
        id, source_id, mission_id, version, capture_time, content_hash, raw_storage_path, normalized_text, title, status_code, headers_json, previous_snapshot_id, has_changed_from_previous
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      snapshot.id,
      snapshot.sourceId,
      snapshot.missionId,
      snapshot.version,
      snapshot.captureTime,
      snapshot.contentHash,
      snapshot.rawStoragePath ?? null,
      snapshot.normalizedText,
      snapshot.title,
      snapshot.statusCode,
      JSON.stringify(snapshot.headers),
      snapshot.previousSnapshotId ?? null,
      snapshot.hasChangedFromPrevious ? 1 : 0
    );
  }

  getSnapshots(missionId: string): Snapshot[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM snapshots WHERE mission_id = ? ORDER BY version ASC').all(missionId) as Record<string, unknown>[];
    return rows.map(r => ({
      id: String(r.id),
      sourceId: String(r.source_id),
      missionId: String(r.mission_id),
      version: Number(r.version),
      captureTime: String(r.capture_time),
      contentHash: String(r.content_hash),
      rawStoragePath: (r.raw_storage_path as string) ?? null,
      normalizedText: String(r.normalized_text),
      title: String(r.title),
      statusCode: Number(r.status_code),
      headers: safeParse(r.headers_json as string, {}),
      previousSnapshotId: (r.previous_snapshot_id as string) ?? null,
      hasChangedFromPrevious: Number(r.has_changed_from_previous) === 1
    }));
  }

  getLatestSnapshotForSource(sourceId: string): Snapshot | null {
    const db = getDatabase();
    const r = db.prepare('SELECT * FROM snapshots WHERE source_id = ? ORDER BY version DESC LIMIT 1').get(sourceId) as Record<string, unknown> | undefined;
    if (!r) return null;
    return {
      id: String(r.id),
      sourceId: String(r.source_id),
      missionId: String(r.mission_id),
      version: Number(r.version),
      captureTime: String(r.capture_time),
      contentHash: String(r.content_hash),
      rawStoragePath: (r.raw_storage_path as string) ?? null,
      normalizedText: String(r.normalized_text),
      title: String(r.title),
      statusCode: Number(r.status_code),
      headers: safeParse(r.headers_json as string, {}),
      previousSnapshotId: (r.previous_snapshot_id as string) ?? null,
      hasChangedFromPrevious: Number(r.has_changed_from_previous) === 1
    };
  }

  getSnapshotById(id: string): Snapshot | null {
    const db = getDatabase();
    const r = db.prepare('SELECT * FROM snapshots WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!r) return null;
    return {
      id: String(r.id),
      sourceId: String(r.source_id),
      missionId: String(r.mission_id),
      version: Number(r.version),
      captureTime: String(r.capture_time),
      contentHash: String(r.content_hash),
      rawStoragePath: (r.raw_storage_path as string) ?? null,
      normalizedText: String(r.normalized_text),
      title: String(r.title),
      statusCode: Number(r.status_code),
      headers: safeParse(r.headers_json as string, {}),
      previousSnapshotId: (r.previous_snapshot_id as string) ?? null,
      hasChangedFromPrevious: Number(r.has_changed_from_previous) === 1
    };
  }

  // --- EVIDENCE RECORDS ---
  createEvidenceBatch(records: EvidenceRecord[]): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO evidence_records (
        id, mission_id, source_id, snapshot_id, exact_excerpt, surrounding_context, locator_json, evidence_type, content_fingerprint, url, page_title, validation_status, is_contradicted, retrieval_timestamp, last_validated_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const rec of records) {
      stmt.run(
        rec.id,
        rec.missionId,
        rec.sourceId,
        rec.snapshotId,
        rec.exactExcerpt,
        rec.surroundingContext,
        JSON.stringify(rec.locator),
        rec.evidenceType,
        rec.contentFingerprint,
        rec.url,
        rec.pageTitle,
        rec.validationStatus,
        rec.isContradicted ? 1 : 0,
        rec.retrievalTimestamp,
        rec.lastValidatedTimestamp
      );
    }
  }

  getEvidenceRecords(missionId: string): EvidenceRecord[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM evidence_records WHERE mission_id = ?').all(missionId) as Record<string, unknown>[];
    return rows.map(r => ({
      id: String(r.id),
      missionId: String(r.mission_id),
      sourceId: String(r.source_id),
      snapshotId: String(r.snapshot_id),
      exactExcerpt: String(r.exact_excerpt),
      surroundingContext: String(r.surrounding_context),
      locator: safeParse(r.locator_json as string, {}),
      evidenceType: r.evidence_type as any,
      contentFingerprint: String(r.content_fingerprint),
      url: String(r.url),
      pageTitle: String(r.page_title),
      validationStatus: r.validation_status as VerificationStatus,
      isContradicted: Number(r.is_contradicted) === 1,
      retrievalTimestamp: String(r.retrieval_timestamp),
      lastValidatedTimestamp: String(r.last_validated_timestamp)
    }));
  }

  updateEvidenceStatus(id: string, status: VerificationStatus, isContradicted?: boolean): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE evidence_records
      SET validation_status = ?,
          is_contradicted = COALESCE(?, is_contradicted),
          last_validated_timestamp = ?
      WHERE id = ?
    `);
    stmt.run(status, isContradicted !== undefined ? (isContradicted ? 1 : 0) : null, now, id);
  }

  // --- CLAIMS ---
  createClaims(claims: Claim[]): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO claims (
        id, mission_id, subject, predicate, value_json, data_type, unit_or_currency, billing_period, supporting_evidence_ids_json, contradictory_evidence_ids_json, confidence, verification_status, extracted_at, last_verified_at, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of claims) {
      stmt.run(
        c.id,
        c.missionId,
        c.subject,
        c.predicate,
        JSON.stringify(c.value),
        c.dataType,
        c.unitOrCurrency ?? null,
        c.billingPeriod ?? null,
        JSON.stringify(c.supportingEvidenceIds),
        JSON.stringify(c.contradictoryEvidenceIds),
        c.confidence,
        c.verificationStatus,
        c.extractedAt,
        c.lastVerifiedAt ?? null,
        c.notes ?? null
      );
    }
  }

  getClaims(missionId: string): Claim[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM claims WHERE mission_id = ?').all(missionId) as Record<string, unknown>[];
    return rows.map(r => ({
      id: String(r.id),
      missionId: String(r.mission_id),
      subject: String(r.subject),
      predicate: String(r.predicate),
      value: safeParse(r.value_json as string, null),
      dataType: r.data_type as any,
      unitOrCurrency: (r.unit_or_currency as string) ?? null,
      billingPeriod: (r.billing_period as string) ?? null,
      supportingEvidenceIds: safeParse(r.supporting_evidence_ids_json as string, []),
      contradictoryEvidenceIds: safeParse(r.contradictory_evidence_ids_json as string, []),
      confidence: Number(r.confidence),
      verificationStatus: r.verification_status as ClaimLifecycleState,
      extractedAt: String(r.extracted_at),
      lastVerifiedAt: (r.last_verified_at as string) ?? null,
      notes: (r.notes as string) ?? null
    }));
  }

  updateClaimStatus(id: string, status: ClaimLifecycleState): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare('UPDATE claims SET verification_status = ?, last_verified_at = ? WHERE id = ?');
    stmt.run(status, now, id);
  }

  updateClaimValue(id: string, value: unknown, status: ClaimLifecycleState, evidenceIds: string[], notes?: string): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE claims
      SET value_json = ?,
          verification_status = ?,
          supporting_evidence_ids_json = ?,
          notes = COALESCE(?, notes),
          last_verified_at = ?
      WHERE id = ?
    `);
    stmt.run(JSON.stringify(value), status, JSON.stringify(evidenceIds), notes ?? null, now, id);
  }

  // --- DEPENDENCY EDGES ---
  createDependencyEdges(edges: DependencyEdge[]): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO dependency_edges (
        id, mission_id, source_node_id, target_node_id, edge_type, is_stale, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const e of edges) {
      stmt.run(
        e.id,
        e.missionId,
        e.sourceNodeId,
        e.targetNodeId,
        e.edgeType,
        e.isStale ? 1 : 0,
        e.createdAt
      );
    }
  }

  getDependencyEdges(missionId: string): DependencyEdge[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM dependency_edges WHERE mission_id = ?').all(missionId) as Record<string, unknown>[];
    return rows.map(r => ({
      id: String(r.id),
      missionId: String(r.mission_id),
      sourceNodeId: String(r.source_node_id),
      targetNodeId: String(r.target_node_id),
      edgeType: r.edge_type as any,
      isStale: Number(r.is_stale) === 1,
      createdAt: String(r.created_at)
    }));
  }

  markEdgesStale(targetNodeIds: string[]): void {
    if (targetNodeIds.length === 0) return;
    const db = getDatabase();
    const placeholders = targetNodeIds.map(() => '?').join(',');
    const stmt = db.prepare(`UPDATE dependency_edges SET is_stale = 1 WHERE target_node_id IN (${placeholders})`);
    stmt.run(...targetNodeIds);
  }

  // --- VERIFICATION RUNS & CHECKS ---
  createVerificationRun(run: VerificationRun): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO verification_runs (
        id, mission_id, verdict, pass_count, fail_count, uncertain_count, unprovable_count, total_checks, summary, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      run.id,
      run.missionId,
      run.verdict,
      run.passCount,
      run.failCount,
      run.uncertainCount,
      run.unprovableCount,
      run.totalChecks,
      run.summary,
      run.createdAt
    );
  }

  createVerificationChecks(checks: VerificationCheck[]): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO verification_checks (
        id, mission_id, run_id, rule_id, name, status, reason, claim_id, evidence_id, expected_value, actual_value, remediation, checked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of checks) {
      stmt.run(
        c.id,
        c.missionId,
        c.runId,
        c.ruleId,
        c.name,
        c.status,
        c.reason,
        c.claimId ?? null,
        c.evidenceId ?? null,
        c.expectedValue ?? null,
        c.actualValue ?? null,
        c.remediation ?? null,
        c.checkedAt
      );
    }
  }

  getVerificationRuns(missionId: string): VerificationRun[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM verification_runs WHERE mission_id = ? ORDER BY created_at DESC').all(missionId) as Record<string, unknown>[];
    return rows.map(r => ({
      id: String(r.id),
      missionId: String(r.mission_id),
      verdict: r.verdict as VerificationStatus,
      passCount: Number(r.pass_count),
      failCount: Number(r.fail_count),
      uncertainCount: Number(r.uncertain_count),
      unprovableCount: Number(r.unprovable_count),
      totalChecks: Number(r.total_checks),
      summary: String(r.summary),
      createdAt: String(r.created_at)
    }));
  }

  getVerificationChecks(runId: string): VerificationCheck[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM verification_checks WHERE run_id = ?').all(runId) as Record<string, unknown>[];
    return rows.map(r => ({
      id: String(r.id),
      missionId: String(r.mission_id),
      runId: String(r.run_id),
      ruleId: String(r.rule_id),
      name: String(r.name),
      status: r.status as VerificationStatus,
      reason: String(r.reason),
      claimId: (r.claim_id as string) ?? null,
      evidenceId: (r.evidence_id as string) ?? null,
      expectedValue: (r.expected_value as string) ?? null,
      actualValue: (r.actual_value as string) ?? null,
      remediation: (r.remediation as string) ?? null,
      checkedAt: String(r.checked_at)
    }));
  }

  // --- ARTIFACTS ---
  clearArtifacts(missionId: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM artifacts WHERE mission_id = ?').run(missionId);
    db.prepare("DELETE FROM dependency_edges WHERE mission_id = ? AND (edge_type = 'CLAIM_TO_CSV_CELL' OR edge_type = 'CLAIM_TO_REPORT_SECTION')").run(missionId);
  }

  createArtifact(artifact: Artifact): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO artifacts (
        id, mission_id, artifact_type, filename, storage_path, mime_type, size_bytes, hash, version, is_validated, validation_errors_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      artifact.id,
      artifact.missionId,
      artifact.artifactType,
      artifact.filename,
      artifact.storagePath,
      artifact.mimeType,
      artifact.sizeBytes,
      artifact.hash,
      artifact.version,
      artifact.isValidated ? 1 : 0,
      JSON.stringify(artifact.validationErrors),
      artifact.createdAt
    );
  }

  getArtifacts(missionId: string): Artifact[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM artifacts WHERE mission_id = ? ORDER BY version DESC, created_at DESC').all(missionId) as Record<string, unknown>[];
    return rows.map(r => ({
      id: String(r.id),
      missionId: String(r.mission_id),
      artifactType: r.artifact_type as any,
      filename: String(r.filename),
      storagePath: String(r.storage_path),
      mimeType: String(r.mime_type),
      sizeBytes: Number(r.size_bytes),
      hash: String(r.hash),
      version: Number(r.version),
      isValidated: Number(r.is_validated) === 1,
      validationErrors: safeParse(r.validation_errors_json as string, []),
      createdAt: String(r.created_at)
    }));
  }

  getArtifactById(id: string): Artifact | null {
    const db = getDatabase();
    const r = db.prepare('SELECT * FROM artifacts WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!r) return null;
    return {
      id: String(r.id),
      missionId: String(r.mission_id),
      artifactType: r.artifact_type as any,
      filename: String(r.filename),
      storagePath: String(r.storage_path),
      mimeType: String(r.mime_type),
      sizeBytes: Number(r.size_bytes),
      hash: String(r.hash),
      version: Number(r.version),
      isValidated: Number(r.is_validated) === 1,
      validationErrors: safeParse(r.validation_errors_json as string, []),
      createdAt: String(r.created_at)
    };
  }

  // --- ACTION LOGS ---
  createActionLog(action: BrowserActionEvent): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO action_logs (
        id, mission_id, action_type, url, selector, input_value, start_time, completion_time, status, error, screenshot_path, source_id, evidence_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      action.actionId,
      action.missionId,
      action.actionType,
      action.url,
      action.selector ?? null,
      action.inputValue ?? null,
      action.startTime,
      action.completionTime,
      action.status,
      action.error ?? null,
      action.screenshotPath ?? null,
      action.sourceId ?? null,
      action.evidenceId ?? null
    );
  }

  getActionLogs(missionId: string): BrowserActionEvent[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM action_logs WHERE mission_id = ? ORDER BY start_time ASC').all(missionId) as Record<string, unknown>[];
    return rows.map(r => ({
      actionId: String(r.id),
      missionId: String(r.mission_id),
      actionType: r.action_type as any,
      url: String(r.url),
      selector: (r.selector as string) ?? undefined,
      inputValue: (r.input_value as string) ?? undefined,
      startTime: String(r.start_time),
      completionTime: String(r.completion_time),
      status: r.status as any,
      error: (r.error as string) ?? undefined,
      screenshotPath: (r.screenshot_path as string) ?? undefined,
      sourceId: (r.source_id as string) ?? undefined,
      evidenceId: (r.evidence_id as string) ?? undefined
    }));
  }

  // --- APPROVALS ---
  createApproval(approval: ApprovalRequest): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO approvals (
        id, mission_id, action_type, target, reason, risk_level, status, requested_at, resolved_at, resolved_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      approval.id,
      approval.missionId,
      approval.actionType,
      approval.target,
      approval.reason,
      approval.riskLevel,
      approval.status,
      approval.requestedAt,
      approval.resolvedAt ?? null,
      approval.resolvedBy ?? null
    );
  }

  getApprovals(missionId: string): ApprovalRequest[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM approvals WHERE mission_id = ? ORDER BY requested_at DESC').all(missionId) as Record<string, unknown>[];
    return rows.map(r => ({
      id: String(r.id),
      missionId: String(r.mission_id),
      actionType: String(r.action_type),
      target: String(r.target),
      reason: String(r.reason),
      riskLevel: r.risk_level as any,
      status: r.status as any,
      requestedAt: String(r.requested_at),
      resolvedAt: (r.resolved_at as string) ?? null,
      resolvedBy: (r.resolved_by as string) ?? undefined
    }));
  }

  resolveApproval(id: string, status: 'approved' | 'denied', resolvedBy = 'user'): void {
    const db = getDatabase();
    const now = new Date().toISOString();
    const stmt = db.prepare('UPDATE approvals SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?');
    stmt.run(status, now, resolvedBy, id);
  }

  // --- DRIFT REPORTS ---
  createDriftReport(report: SourceDriftReport): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO drift_reports (
        id, mission_id, source_id, old_snapshot_id, new_snapshot_id, detected_at, has_drift, line_diff_json, field_changes_json, stale_claim_ids_json, stale_evidence_ids_json, affected_checks_json, affected_artifacts_json, revalidation_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      report.id,
      report.missionId,
      report.sourceId,
      report.oldSnapshotId,
      report.newSnapshotId,
      report.detectedAt,
      report.hasDrift ? 1 : 0,
      JSON.stringify(report.lineDiff),
      JSON.stringify(report.fieldChanges),
      JSON.stringify(report.staleClaimIds),
      JSON.stringify(report.staleEvidenceIds),
      JSON.stringify(report.affectedChecks),
      JSON.stringify(report.affectedArtifacts),
      report.revalidationStatus
    );
  }

  getDriftReports(missionId: string): SourceDriftReport[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM drift_reports WHERE mission_id = ? ORDER BY detected_at DESC').all(missionId) as Record<string, unknown>[];
    return rows.map(r => ({
      id: String(r.id),
      missionId: String(r.mission_id),
      sourceId: String(r.source_id),
      oldSnapshotId: String(r.old_snapshot_id),
      newSnapshotId: String(r.new_snapshot_id),
      detectedAt: String(r.detected_at),
      hasDrift: Number(r.has_drift) === 1,
      lineDiff: safeParse(r.line_diff_json as string, { added: [], removed: [] }),
      fieldChanges: safeParse(r.field_changes_json as string, []),
      staleClaimIds: safeParse(r.stale_claim_ids_json as string, []),
      staleEvidenceIds: safeParse(r.stale_evidence_ids_json as string, []),
      affectedChecks: safeParse(r.affected_checks_json as string, []),
      affectedArtifacts: safeParse(r.affected_artifacts_json as string, []),
      revalidationStatus: r.revalidation_status as any
    }));
  }

  getDriftReportById(id: string): SourceDriftReport | null {
    const db = getDatabase();
    const r = db.prepare('SELECT * FROM drift_reports WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!r) return null;
    return {
      id: String(r.id),
      missionId: String(r.mission_id),
      sourceId: String(r.source_id),
      oldSnapshotId: String(r.old_snapshot_id),
      newSnapshotId: String(r.new_snapshot_id),
      detectedAt: String(r.detected_at),
      hasDrift: Number(r.has_drift) === 1,
      lineDiff: safeParse(r.line_diff_json as string, { added: [], removed: [] }),
      fieldChanges: safeParse(r.field_changes_json as string, []),
      staleClaimIds: safeParse(r.stale_claim_ids_json as string, []),
      staleEvidenceIds: safeParse(r.stale_evidence_ids_json as string, []),
      affectedChecks: safeParse(r.affected_checks_json as string, []),
      affectedArtifacts: safeParse(r.affected_artifacts_json as string, []),
      revalidationStatus: r.revalidation_status as any
    };
  }

  updateDriftReportStatus(id: string, status: 'pending' | 'in_progress' | 'completed' | 'failed'): void {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE drift_reports SET revalidation_status = ? WHERE id = ?');
    stmt.run(status, id);
  }
}

export const repo = new Repository();
