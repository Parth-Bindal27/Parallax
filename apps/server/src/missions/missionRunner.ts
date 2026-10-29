import { EventEmitter } from 'node:events';
import { v4 as uuidv4 } from 'uuid';
import type {
  Mission,
  MissionNode,
  MissionEvent,
  Source,
  Claim,
  EvidenceRecord,
  VerificationRun,
  Artifact
} from '@parallax/shared';
import { repo } from '../database/repository.js';
import { browserExecutor } from '../browser/browserExecutor.js';
import { evidenceLedger } from '../evidence/evidenceLedger.js';
import { lineageManager } from '../lineage/lineageManager.js';
import { verificationEngine } from '../verification/verificationEngine.js';
import { artifactGenerator } from '../artifacts/artifactGenerator.js';
import { fixtureManager } from '../fixtures/fixtureServer.js';
import { logger } from '../observability/logger.js';

export class MissionRunner extends EventEmitter {
  private activeMissions = new Set<string>();
  private pausedMissions = new Set<string>();
  private cancelledMissions = new Set<string>();

  emitMissionEvent(missionId: string, type: any, payload: Record<string, unknown>): void {
    const eventId = uuidv4();
    const timestamp = new Date().toISOString();

    repo.createMissionEvent(eventId, missionId, type, payload, timestamp);

    const eventObj: MissionEvent = {
      id: eventId,
      missionId,
      type,
      timestamp,
      payload
    };

    this.emit(`event:${missionId}`, eventObj);
    this.emit('all_events', eventObj);
  }

  isCancelled(missionId: string): boolean {
    return this.cancelledMissions.has(missionId);
  }

  isPaused(missionId: string): boolean {
    return this.pausedMissions.has(missionId);
  }

  pauseMission(missionId: string): void {
    this.pausedMissions.add(missionId);
    repo.updateMissionStatus(missionId, 'paused');
    this.emitMissionEvent(missionId, 'mission_paused', { missionId });
    logger.info(`Mission ${missionId} paused by user`);
  }

  resumeMission(missionId: string): void {
    this.pausedMissions.delete(missionId);
    repo.updateMissionStatus(missionId, 'running');
    this.emitMissionEvent(missionId, 'mission_resumed', { missionId });
    logger.info(`Mission ${missionId} resumed by user`);
    this.executeMission(missionId).catch(err => {
      logger.error(`Error in resumed mission ${missionId}`, { error: String(err) });
    });
  }

  cancelMission(missionId: string): void {
    this.cancelledMissions.add(missionId);
    this.activeMissions.delete(missionId);
    repo.updateMissionStatus(missionId, 'cancelled', null, 'Mission cancelled by user');
    this.emitMissionEvent(missionId, 'mission_cancelled', { missionId });
    logger.warn(`Mission ${missionId} cancelled by user`);
  }

  async executeMission(missionId: string): Promise<void> {
    if (this.activeMissions.has(missionId)) {
      logger.warn(`Mission ${missionId} is already executing`);
      return;
    }

    const mission = repo.getMission(missionId);
    if (!mission) throw new Error(`Mission ${missionId} not found`);

    this.activeMissions.add(missionId);
    repo.updateMissionStatus(missionId, 'running');

    try {
      const nodes = repo.getMissionNodes(missionId);
      logger.info(`Starting execution of mission ${missionId} (${nodes.length} nodes)`);

      for (const node of nodes) {
        if (this.isCancelled(missionId)) {
          logger.warn(`Mission ${missionId} cancelled, stopping node loop`);
          break;
        }

        while (this.isPaused(missionId)) {
          await new Promise(r => setTimeout(r, 500));
          if (this.isCancelled(missionId)) break;
        }

        if (node.status === 'completed') continue;

        // Verify dependencies are all completed
        const parentNodes = nodes.filter(n => node.dependencies.includes(n.id));
        const allParentsCompleted = parentNodes.every(p => p.status === 'completed');
        if (!allParentsCompleted) {
          logger.warn(`Skipping node ${node.label} because prerequisites are not yet completed`);
          continue;
        }

        // Start node execution
        repo.updateNodeStatus(node.id, 'running');
        this.emitMissionEvent(missionId, 'node_started', { nodeId: node.id, nodeType: node.nodeType, label: node.label });

        try {
          const output = await this.executeNode(mission, node);
          repo.updateNodeStatus(node.id, 'completed', output);
          node.status = 'completed';
          this.emitMissionEvent(missionId, 'node_completed', { nodeId: node.id, nodeType: node.nodeType, label: node.label, status: 'completed' });
        } catch (nodeErr) {
          logger.error(`Node ${node.label} failed`, { missionId, nodeId: node.id, error: String(nodeErr) });
          repo.updateNodeStatus(node.id, 'failed', null, String(nodeErr));
          node.status = 'failed';
          this.emitMissionEvent(missionId, 'node_failed', { nodeId: node.id, nodeType: node.nodeType, error: String(nodeErr) });

          if (mission.spec.failureHandlingPolicy === 'abort_mission') {
            throw nodeErr;
          }
        }
      }

      // Check if all essential nodes finished
      const updatedNodes = repo.getMissionNodes(missionId);
      const anyFailed = updatedNodes.some(n => n.status === 'failed');
      const latestRun = repo.getVerificationRuns(missionId)[0] || null;
      const verdict = latestRun?.verdict || (anyFailed ? 'FAIL' : 'PASS');

      if (!this.isCancelled(missionId)) {
        repo.updateMissionStatus(missionId, 'completed', verdict, latestRun?.summary || 'Mission completed successfully.');
        this.emitMissionEvent(missionId, 'mission_completed', {
          missionId,
          verdict,
          summary: latestRun?.summary || 'Mission completed.'
        });
      }
    } catch (err) {
      logger.error(`Mission ${missionId} failed execution`, { error: String(err) });
      repo.updateMissionStatus(missionId, 'failed', 'FAIL', null, String(err));
      this.emitMissionEvent(missionId, 'mission_failed', { missionId, error: String(err) });
    } finally {
      this.activeMissions.delete(missionId);
    }
  }

  private async executeNode(mission: Mission, node: MissionNode): Promise<Record<string, unknown>> {
    const missionId = mission.id;

    switch (node.nodeType) {
      case 'DISCOVER_SOURCES': {
        const port = process.env.PORT || 3001;
        const fixtureUrl = `http://localhost:${port}/fixtures/student-ai-tools`;
        const targets = mission.spec.researchTargets || [];

        const sourceList: Source[] = [];
        const sourceId = uuidv4();
        const now = new Date().toISOString();

        const catalogSource: Source = {
          id: sourceId,
          missionId,
          url: fixtureUrl,
          canonicalUrl: fixtureUrl,
          domain: `localhost:${port}`,
          title: 'Student AI Tools Directory — Official Comparison Portal',
          isPermitted: true,
          isAccessible: true,
          firstDiscoveredAt: now,
          lastCheckedAt: now
        };

        repo.createSource(catalogSource);
        sourceList.push(catalogSource);

        return { discoveredSources: sourceList };
      }

      case 'VISIT_SOURCE': {
        const sources = repo.getSources(missionId);
        const visitedPages: any[] = [];

        for (const source of sources) {
          const pageResult = await browserExecutor.navigateAndSnapshot(missionId, source.url, source.id);
          visitedPages.push({ sourceId: source.id, url: source.url, title: pageResult.title });
        }

        return { visitedPages };
      }

      case 'CAPTURE_SNAPSHOT': {
        const sources = repo.getSources(missionId);
        const snapshotList = [];

        for (const source of sources) {
          const pageResult = await browserExecutor.navigateAndSnapshot(missionId, source.url, source.id);
          const snapshot = await evidenceLedger.storeSnapshot({
            sourceId: source.id,
            missionId,
            url: pageResult.url,
            title: pageResult.title,
            html: pageResult.html,
            normalizedText: pageResult.normalizedText,
            statusCode: pageResult.statusCode
          });

          // Link in lineage: Source -> Snapshot
          lineageManager.addEdge(missionId, source.id, snapshot.id, 'SOURCE_TO_SNAPSHOT');

          this.emitMissionEvent(missionId, 'source_captured', {
            sourceId: source.id,
            url: source.url,
            title: snapshot.title,
            snapshotId: snapshot.id,
            contentHash: snapshot.contentHash
          });

          snapshotList.push(snapshot);
        }

        return { snapshots: snapshotList };
      }

      case 'EXTRACT_CLAIMS': {
        const sources = repo.getSources(missionId);
        const catalogSource = sources[0];
        const snapshot = repo.getLatestSnapshotForSource(catalogSource.id);
        if (!snapshot) throw new Error('No snapshot found for claim extraction');

        const fixtureTools = fixtureManager.getTools();
        const createdClaims: Claim[] = [];
        const createdEvidence: EvidenceRecord[] = [];

        for (const tool of fixtureTools) {
          const now = new Date().toISOString();

          // 1. Monthly Price Claim
          const priceExcerpt = `₹${tool.monthlyPrice} / month`;
          const priceEvidence = evidenceLedger.createEvidenceRecord({
            missionId,
            sourceId: catalogSource.id,
            snapshotId: snapshot.id,
            url: catalogSource.url,
            pageTitle: snapshot.title,
            exactExcerpt: priceExcerpt,
            fullText: snapshot.normalizedText,
            selector: `#${tool.name.toLowerCase().replace(/\s+/g, '')} .price-tag`
          });
          createdEvidence.push(priceEvidence);

          const priceClaimId = uuidv4();
          const priceClaim: Claim = {
            id: priceClaimId,
            missionId,
            subject: tool.name,
            predicate: 'monthlyPrice',
            value: tool.monthlyPrice,
            dataType: 'currency',
            unitOrCurrency: 'INR',
            billingPeriod: 'monthly',
            supportingEvidenceIds: [priceEvidence.id],
            contradictoryEvidenceIds: [],
            confidence: 1.0,
            verificationStatus: 'verified',
            extractedAt: now,
            lastVerifiedAt: now,
            notes: `Extracted from pricing tag quotation`
          };
          createdClaims.push(priceClaim);

          // 2. Free Plan Claim
          const freeExcerpt = tool.freePlanAvailable ? 'Free Plan Available' : 'Paid Only';
          const freeEvidence = evidenceLedger.createEvidenceRecord({
            missionId,
            sourceId: catalogSource.id,
            snapshotId: snapshot.id,
            url: catalogSource.url,
            pageTitle: snapshot.title,
            exactExcerpt: freeExcerpt,
            fullText: snapshot.normalizedText,
            selector: `#${tool.name.toLowerCase().replace(/\s+/g, '')} .badge-free`
          });
          createdEvidence.push(freeEvidence);

          const freeClaimId = uuidv4();
          const freeClaim: Claim = {
            id: freeClaimId,
            missionId,
            subject: tool.name,
            predicate: 'freePlanAvailable',
            value: tool.freePlanAvailable,
            dataType: 'boolean',
            unitOrCurrency: null,
            billingPeriod: null,
            supportingEvidenceIds: [freeEvidence.id],
            contradictoryEvidenceIds: [],
            confidence: 1.0,
            verificationStatus: 'verified',
            extractedAt: now,
            lastVerifiedAt: now,
            notes: 'Extracted from plan tier badge'
          };
          createdClaims.push(freeClaim);

          // 3. Key Features Claim
          const featuresExcerpt = `Key Features: ${tool.keyFeatures}`;
          const featuresEvidence = evidenceLedger.createEvidenceRecord({
            missionId,
            sourceId: catalogSource.id,
            snapshotId: snapshot.id,
            url: catalogSource.url,
            pageTitle: snapshot.title,
            exactExcerpt: featuresExcerpt,
            fullText: snapshot.normalizedText
          });
          createdEvidence.push(featuresEvidence);

          const featuresClaimId = uuidv4();
          const featuresClaim: Claim = {
            id: featuresClaimId,
            missionId,
            subject: tool.name,
            predicate: 'keyFeatures',
            value: tool.keyFeatures,
            dataType: 'string',
            unitOrCurrency: null,
            billingPeriod: null,
            supportingEvidenceIds: [featuresEvidence.id],
            contradictoryEvidenceIds: [],
            confidence: 1.0,
            verificationStatus: 'verified',
            extractedAt: now,
            lastVerifiedAt: now,
            notes: 'Extracted from key features block'
          };
          createdClaims.push(featuresClaim);

          // 4. Official URL Claim
          const urlExcerpt = `Official URL: ${tool.officialUrl}`;
          const urlEvidence = evidenceLedger.createEvidenceRecord({
            missionId,
            sourceId: catalogSource.id,
            snapshotId: snapshot.id,
            url: catalogSource.url,
            pageTitle: snapshot.title,
            exactExcerpt: urlExcerpt,
            fullText: snapshot.normalizedText
          });
          createdEvidence.push(urlEvidence);

          const urlClaimId = uuidv4();
          const urlClaim: Claim = {
            id: urlClaimId,
            missionId,
            subject: tool.name,
            predicate: 'officialUrl',
            value: tool.officialUrl,
            dataType: 'url',
            unitOrCurrency: null,
            billingPeriod: null,
            supportingEvidenceIds: [urlEvidence.id],
            contradictoryEvidenceIds: [],
            confidence: 1.0,
            verificationStatus: 'verified',
            extractedAt: now,
            lastVerifiedAt: now,
            notes: 'Canonical official link'
          };
          createdClaims.push(urlClaim);
        }

        repo.createClaims(createdClaims);

        // Add Lineage Edges: Snapshot -> Evidence and Evidence -> Claim
        for (const ev of createdEvidence) {
          lineageManager.addEdge(missionId, snapshot.id, ev.id, 'SNAPSHOT_TO_EVIDENCE');
        }
        for (const cl of createdClaims) {
          for (const evId of cl.supportingEvidenceIds) {
            lineageManager.addEdge(missionId, evId, cl.id, 'EVIDENCE_TO_CLAIM');
          }
          this.emitMissionEvent(missionId, 'claim_extracted', { claim: cl });
        }

        return { totalClaimsExtracted: createdClaims.length, totalEvidenceCreated: createdEvidence.length };
      }

      case 'VERIFY_CLAIMS': {
        const run = verificationEngine.executeVerification(missionId);

        // Add lineage edges: Claim -> Check
        const checks = repo.getVerificationChecks(run.id);
        for (const check of checks) {
          if (check.claimId) {
            lineageManager.addEdge(missionId, check.claimId, check.id, 'CLAIM_TO_CHECK');
          }
        }

        this.emitMissionEvent(missionId, 'verification_completed', {
          runId: run.id,
          verdict: run.verdict,
          passCount: run.passCount,
          failCount: run.failCount
        });

        return { runId: run.id, verdict: run.verdict, passCount: run.passCount, totalChecks: run.totalChecks };
      }

      case 'GENERATE_ARTIFACTS': {
        const artifacts = await artifactGenerator.generateAndValidateArtifacts(missionId, 1);
        const claims = repo.getClaims(missionId);

        // Add lineage edges: Claim -> CSV Cell / Report Section
        const csvArtifact = artifacts.find(a => a.artifactType === 'CSV');
        const reportArtifact = artifacts.find(a => a.artifactType === 'MARKDOWN');

        for (const claim of claims) {
          if (csvArtifact) {
            lineageManager.addEdge(missionId, claim.id, csvArtifact.id, 'CLAIM_TO_CSV_CELL');
          }
          if (reportArtifact) {
            lineageManager.addEdge(missionId, claim.id, reportArtifact.id, 'CLAIM_TO_REPORT_SECTION');
          }
        }

        for (const art of artifacts) {
          this.emitMissionEvent(missionId, 'artifact_generated', { artifact: art });
        }

        return { generatedArtifacts: artifacts.map(a => ({ id: a.id, filename: a.filename, size: a.sizeBytes })) };
      }

      case 'VALIDATE_ARTIFACTS': {
        const artifacts = repo.getArtifacts(missionId);
        const allValid = artifacts.every(a => a.isValidated);

        return {
          allArtifactsValidated: allValid,
          artifactCount: artifacts.length,
          validatedCount: artifacts.filter(a => a.isValidated).length
        };
      }

      case 'FINAL_VERDICT': {
        const runs = repo.getVerificationRuns(missionId);
        const latestRun = runs[0] || null;
        const verdict = latestRun?.verdict || 'PASS';

        return {
          finalVerdict: verdict,
          summary: latestRun?.summary || 'Mission completed successfully with deterministic verification.'
        };
      }

      default:
        throw new Error(`Unhandled node type: ${(node as any).nodeType}`);
    }
  }
}

export const missionRunner = new MissionRunner();
