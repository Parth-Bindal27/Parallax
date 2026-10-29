import { v4 as uuidv4 } from 'uuid';
import type {
  SourceDriftReport,
  Claim,
  EvidenceRecord,
  Snapshot
} from '@parallax/shared';
import { repo } from '../database/repository.js';
import { browserExecutor } from '../browser/browserExecutor.js';
import { evidenceLedger } from '../evidence/evidenceLedger.js';
import { lineageManager } from '../lineage/lineageManager.js';
import { verificationEngine } from '../verification/verificationEngine.js';
import { artifactGenerator } from '../artifacts/artifactGenerator.js';
import { logger } from '../observability/logger.js';

export class DriftDetector {
  /**
   * Computes simple line diff between two texts
   */
  computeLineDiff(oldText: string, newText: string): { added: string[]; removed: string[] } {
    const oldLines = new Set(oldText.split('\n').map(l => l.trim()).filter(Boolean));
    const newLines = new Set(newText.split('\n').map(l => l.trim()).filter(Boolean));

    const added: string[] = [];
    const removed: string[] = [];

    for (const line of newLines) {
      if (!oldLines.has(line)) added.push(line);
    }
    for (const line of oldLines) {
      if (!newLines.has(line)) removed.push(line);
    }

    return { added, removed };
  }

  /**
   * Checks a source for drift by re-fetching and comparing snapshots
   */
  async checkSourceDrift(missionId: string, sourceId: string): Promise<SourceDriftReport> {
    const source = repo.getSourceById(sourceId);
    if (!source) throw new Error(`Source ${sourceId} not found`);

    const latestOldSnapshot = repo.getLatestSnapshotForSource(sourceId);
    if (!latestOldSnapshot) throw new Error(`No baseline snapshot found for source ${sourceId}`);

    logger.info(`Re-fetching source ${source.url} for drift detection`, { missionId, sourceId });

    // Re-fetch using Playwright
    const pageResult = await browserExecutor.navigateAndSnapshot(missionId, source.url, sourceId);

    // Store new snapshot
    const newSnapshot = await evidenceLedger.storeSnapshot({
      sourceId,
      missionId,
      url: pageResult.url,
      title: pageResult.title,
      html: pageResult.html,
      normalizedText: pageResult.normalizedText,
      statusCode: pageResult.statusCode
    });

    // Connect source to new snapshot in lineage
    lineageManager.addEdge(missionId, source.id, newSnapshot.id, 'SOURCE_TO_SNAPSHOT');

    const hasDrift = latestOldSnapshot.contentHash !== newSnapshot.contentHash;
    const lineDiff = hasDrift ? this.computeLineDiff(latestOldSnapshot.normalizedText, newSnapshot.normalizedText) : { added: [], removed: [] };

    const staleEvidenceIds: string[] = [];
    const staleClaimIds: string[] = [];
    const fieldChanges: SourceDriftReport['fieldChanges'] = [];

    if (hasDrift) {
      logger.warn(`Source drift detected for ${source.url}! Analyzing affected evidence and claims...`);

      // Find all existing evidence referencing the source
      const allEvidence = repo.getEvidenceRecords(missionId).filter(e => e.sourceId === sourceId);
      const allClaims = repo.getClaims(missionId);

      for (const ev of allEvidence) {
        // Check if the exact quotation still exists in the new snapshot
        const stillPresent = newSnapshot.normalizedText.includes(ev.exactExcerpt);
        if (!stillPresent) {
          staleEvidenceIds.push(ev.id);
          repo.updateEvidenceStatus(ev.id, 'UNCERTAIN');

          // Find claims supporting this evidence
          for (const claim of allClaims) {
            if (claim.supportingEvidenceIds.includes(ev.id)) {
              staleClaimIds.push(claim.id);
              repo.updateClaimStatus(claim.id, 'stale');

              fieldChanges.push({
                subject: claim.subject,
                predicate: claim.predicate,
                oldValue: String(claim.value),
                newValue: null // will be re-extracted during revalidation
              });
            }
          }
        }
      }
    }

    // Traverse lineage graph to compute downstream impact
    const impact = lineageManager.computeDownstreamImpact(missionId, newSnapshot.id, staleEvidenceIds);

    const reportId = uuidv4();
    const driftReport: SourceDriftReport = {
      id: reportId,
      missionId,
      sourceId,
      oldSnapshotId: latestOldSnapshot.id,
      newSnapshotId: newSnapshot.id,
      detectedAt: new Date().toISOString(),
      hasDrift,
      lineDiff,
      fieldChanges,
      staleClaimIds: Array.from(new Set(staleClaimIds)),
      staleEvidenceIds: Array.from(new Set(staleEvidenceIds)),
      affectedChecks: impact.affectedChecks,
      affectedArtifacts: impact.affectedArtifacts,
      revalidationStatus: hasDrift ? 'pending' : 'completed'
    };

    repo.createDriftReport(driftReport);

    if (hasDrift) {
      repo.createMissionEvent(
        uuidv4(),
        missionId,
        'source_drift_detected',
        { driftReport },
        new Date().toISOString()
      );

      repo.createMissionEvent(
        uuidv4(),
        missionId,
        'dependency_invalidated',
        {
          staleClaimIds: driftReport.staleClaimIds,
          staleEvidenceIds: driftReport.staleEvidenceIds,
          affectedArtifacts: driftReport.affectedArtifacts
        },
        new Date().toISOString()
      );
    }

    return driftReport;
  }

  /**
   * Executes selective revalidation of only the affected claims and artifacts
   */
  async executeSelectiveRevalidation(driftReportId: string): Promise<{
    driftReport: SourceDriftReport;
    updatedClaims: Claim[];
    newRun: any;
    newArtifacts: any[];
  }> {
    const driftReport = repo.getDriftReportById(driftReportId);
    if (!driftReport) throw new Error(`Drift report ${driftReportId} not found`);

    const missionId = driftReport.missionId;
    const mission = repo.getMission(missionId);
    if (!mission) throw new Error(`Mission ${missionId} not found`);

    const newSnapshot = repo.getSnapshotById(driftReport.newSnapshotId);
    if (!newSnapshot) throw new Error(`New snapshot ${driftReport.newSnapshotId} not found`);

    logger.info(`Starting selective revalidation for ${driftReport.staleClaimIds.length} stale claims`, { driftReportId });
    repo.updateDriftReportStatus(driftReportId, 'in_progress');

    const updatedClaims: Claim[] = [];
    const source = repo.getSourceById(driftReport.sourceId);

    // 1. Re-extract only the affected claims from the new snapshot text
    for (const claimId of driftReport.staleClaimIds) {
      const claim = repo.getClaims(missionId).find(c => c.id === claimId);
      if (!claim) continue;

      logger.info(`Re-extracting stale claim: ${claim.subject}.${claim.predicate}`);

      // Extract new value from new snapshot text
      let newValue: unknown = claim.value;
      let newExcerpt = '';

      if (claim.predicate === 'monthlyPrice') {
        // Look for ₹ or INR or price patterns in new text
        const priceMatch = newSnapshot.normalizedText.match(/(?:₹|INR|Rs\.?)\s*(\d+)/i) ||
                           newSnapshot.normalizedText.match(/(\d+)\s*(?:INR|rupees|\/mo|\/month)/i);
        if (priceMatch) {
          newValue = Number(priceMatch[1]);
          newExcerpt = priceMatch[0];
        }
      } else if (claim.predicate === 'keyFeatures') {
        const featureLines = newSnapshot.normalizedText.split('\n').filter(l => l.includes('•') || l.includes('-') || l.length > 20);
        if (featureLines.length > 0) {
          newValue = featureLines.slice(0, 3).join('; ');
          newExcerpt = featureLines[0];
        }
      }

      // Create new evidence record for the updated claim
      let newEvidenceId = claim.supportingEvidenceIds[0];
      if (newExcerpt) {
        const ev = evidenceLedger.createEvidenceRecord({
          missionId,
          sourceId: driftReport.sourceId,
          snapshotId: newSnapshot.id,
          url: source?.url || '',
          pageTitle: newSnapshot.title,
          exactExcerpt: newExcerpt,
          fullText: newSnapshot.normalizedText
        });
        newEvidenceId = ev.id;

        // Add lineage edge
        lineageManager.addEdge(missionId, newSnapshot.id, ev.id, 'SNAPSHOT_TO_EVIDENCE');
        lineageManager.addEdge(missionId, ev.id, claim.id, 'EVIDENCE_TO_CLAIM');
      }

      // Update claim with new value and mark status verified
      repo.updateClaimValue(claim.id, newValue, 'verified', [newEvidenceId], `Revalidated from snapshot v${newSnapshot.version}`);
      
      const updatedClaim = repo.getClaims(missionId).find(c => c.id === claim.id);
      if (updatedClaim) updatedClaims.push(updatedClaim);
    }

    // 2. Re-run deterministic verification
    const newRun = verificationEngine.executeVerification(missionId);

    // 3. Regenerate affected artifacts with version 2
    const newArtifacts = await artifactGenerator.generateAndValidateArtifacts(missionId, 2);

    // 4. Update drift report status to completed
    repo.updateDriftReportStatus(driftReportId, 'completed');
    driftReport.revalidationStatus = 'completed';

    // 5. Update mission overall verdict
    repo.updateMissionStatus(missionId, 'completed', newRun.verdict, `Selective revalidation completed: ${newRun.summary}`);

    repo.createMissionEvent(
      uuidv4(),
      missionId,
      'verification_completed',
      { runId: newRun.id, verdict: newRun.verdict, passCount: newRun.passCount, failCount: newRun.failCount },
      new Date().toISOString()
    );

    logger.info(`Selective revalidation completed successfully. New mission verdict: ${newRun.verdict}`);

    return {
      driftReport,
      updatedClaims,
      newRun,
      newArtifacts
    };
  }
}

export const driftDetector = new DriftDetector();
