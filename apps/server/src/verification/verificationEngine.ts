import { v4 as uuidv4 } from 'uuid';
import type {
  VerificationCheck,
  VerificationRun,
  VerificationStatus,
  Claim,
  EvidenceRecord,
  Snapshot
} from '@parallax/shared';
import { repo } from '../database/repository.js';
import { logger } from '../observability/logger.js';

export class VerificationEngine {
  /**
   * Executes deterministic verification on all claims in a mission
   */
  executeVerification(missionId: string): VerificationRun {
    const runId = uuidv4();
    const checkedAt = new Date().toISOString();
    const claims = repo.getClaims(missionId);
    const evidenceList = repo.getEvidenceRecords(missionId);
    const snapshots = repo.getSnapshots(missionId);

    const evidenceMap = new Map<string, EvidenceRecord>();
    for (const ev of evidenceList) {
      evidenceMap.set(ev.id, ev);
    }

    const snapshotMap = new Map<string, Snapshot>();
    for (const sn of snapshots) {
      snapshotMap.set(sn.id, sn);
    }

    const checks: VerificationCheck[] = [];

    for (const claim of claims) {
      // Rule 1: FIELD_REQUIRED
      if (claim.value === null || claim.value === undefined || claim.value === '') {
        checks.push({
          id: uuidv4(),
          missionId,
          runId,
          ruleId: 'FIELD_REQUIRED',
          name: 'Required Field Presence',
          status: 'FAIL',
          reason: `Field '${claim.predicate}' for entity '${claim.subject}' has no extracted value.`,
          claimId: claim.id,
          evidenceId: null,
          expectedValue: 'Non-empty value',
          actualValue: String(claim.value),
          remediation: 'Inspect page structure or re-run extraction with updated field selector.',
          checkedAt
        });
      } else {
        checks.push({
          id: uuidv4(),
          missionId,
          runId,
          ruleId: 'FIELD_REQUIRED',
          name: 'Required Field Presence',
          status: 'PASS',
          reason: `Field '${claim.predicate}' has valid non-empty value: ${String(claim.value)}`,
          claimId: claim.id,
          evidenceId: null,
          expectedValue: 'Non-empty value',
          actualValue: String(claim.value),
          remediation: null,
          checkedAt
        });
      }

      // Rule 2: EVIDENCE_EXISTS
      if (!claim.supportingEvidenceIds || claim.supportingEvidenceIds.length === 0) {
        checks.push({
          id: uuidv4(),
          missionId,
          runId,
          ruleId: 'EVIDENCE_EXISTS',
          name: 'Evidence Ledger Link',
          status: 'UNCERTAIN',
          reason: `Claim '${claim.subject}.${claim.predicate}' has no supporting evidence attached.`,
          claimId: claim.id,
          evidenceId: null,
          expectedValue: '>= 1 evidence reference',
          actualValue: '0 evidence references',
          remediation: 'Attach supporting quotation from a verified source snapshot.',
          checkedAt
        });
        continue;
      }

      checks.push({
        id: uuidv4(),
        missionId,
        runId,
        ruleId: 'EVIDENCE_EXISTS',
        name: 'Evidence Ledger Link',
        status: 'PASS',
        reason: `Claim references ${claim.supportingEvidenceIds.length} evidence record(s).`,
        claimId: claim.id,
        evidenceId: claim.supportingEvidenceIds[0],
        expectedValue: '>= 1 evidence reference',
        actualValue: `${claim.supportingEvidenceIds.length} references`,
        remediation: null,
        checkedAt
      });

      // Rule 3: EXCERPT_IN_SNAPSHOT & LINK_INTEGRITY
      for (const evId of claim.supportingEvidenceIds) {
        const ev = evidenceMap.get(evId);
        if (!ev) {
          checks.push({
            id: uuidv4(),
            missionId,
            runId,
            ruleId: 'LINK_INTEGRITY',
            name: 'Evidence Link Integrity',
            status: 'FAIL',
            reason: `Evidence record ID '${evId}' referenced by claim does not exist in ledger.`,
            claimId: claim.id,
            evidenceId: evId,
            expectedValue: 'Existing evidence record',
            actualValue: 'Missing',
            remediation: 'Rebuild evidence linkage or re-run claim extraction.',
            checkedAt
          });
          continue;
        }

        const snapshot = snapshotMap.get(ev.snapshotId);
        if (!snapshot) {
          checks.push({
            id: uuidv4(),
            missionId,
            runId,
            ruleId: 'EXCERPT_IN_SNAPSHOT',
            name: 'Snapshot Excerpt Verification',
            status: 'UNPROVABLE',
            reason: `Underlying snapshot '${ev.snapshotId}' is missing or was pruned.`,
            claimId: claim.id,
            evidenceId: ev.id,
            expectedValue: 'Accessible snapshot record',
            actualValue: 'Missing snapshot',
            remediation: 'Recapture snapshot for source.',
            checkedAt
          });
          continue;
        }

        const existsInSnapshot = snapshot.normalizedText.includes(ev.exactExcerpt);
        if (existsInSnapshot) {
          checks.push({
            id: uuidv4(),
            missionId,
            runId,
            ruleId: 'EXCERPT_IN_SNAPSHOT',
            name: 'Snapshot Excerpt Exact Match',
            status: 'PASS',
            reason: `Exact supporting excerpt "${ev.exactExcerpt.slice(0, 45)}..." verified in snapshot v${snapshot.version}.`,
            claimId: claim.id,
            evidenceId: ev.id,
            expectedValue: ev.exactExcerpt,
            actualValue: 'Matched in snapshot text',
            remediation: null,
            checkedAt
          });
        } else {
          checks.push({
            id: uuidv4(),
            missionId,
            runId,
            ruleId: 'EXCERPT_IN_SNAPSHOT',
            name: 'Snapshot Excerpt Exact Match',
            status: 'FAIL',
            reason: `Supporting excerpt does not match snapshot text. Possible hallucination or drift.`,
            claimId: claim.id,
            evidenceId: ev.id,
            expectedValue: ev.exactExcerpt,
            actualValue: 'Not found in snapshot',
            remediation: 'Re-extract claim from current snapshot.',
            checkedAt
          });
        }
      }

      // Rule 4: CURRENCY_NORMALIZATION (for currency fields)
      if (claim.dataType === 'currency') {
        const valNum = Number(claim.value);
        if (isNaN(valNum) || valNum <= 0) {
          checks.push({
            id: uuidv4(),
            missionId,
            runId,
            ruleId: 'CURRENCY_NORMALIZATION',
            name: 'Currency & Price Normalization',
            status: 'FAIL',
            reason: `Currency value '${claim.value}' is not a valid positive number.`,
            claimId: claim.id,
            evidenceId: null,
            expectedValue: 'Valid positive numeric price',
            actualValue: String(claim.value),
            remediation: 'Normalize price regex to extract numeric digits.',
            checkedAt
          });
        } else {
          checks.push({
            id: uuidv4(),
            missionId,
            runId,
            ruleId: 'CURRENCY_NORMALIZATION',
            name: 'Currency & Price Normalization',
            status: 'PASS',
            reason: `Normalized price verified: ${claim.unitOrCurrency || ''}${valNum} per ${claim.billingPeriod || 'month'}`,
            claimId: claim.id,
            evidenceId: null,
            expectedValue: 'Valid positive numeric price',
            actualValue: `${claim.unitOrCurrency || ''}${valNum}`,
            remediation: null,
            checkedAt
          });
        }
      }

      // Rule 5: NO_CONTRADICTION
      if (claim.contradictoryEvidenceIds && claim.contradictoryEvidenceIds.length > 0) {
        checks.push({
          id: uuidv4(),
          missionId,
          runId,
          ruleId: 'NO_CONTRADICTION',
          name: 'Contradiction Audit',
          status: 'FAIL',
          reason: `Claim has ${claim.contradictoryEvidenceIds.length} conflicting evidence record(s).`,
          claimId: claim.id,
          evidenceId: claim.contradictoryEvidenceIds[0],
          expectedValue: 'No contradictory evidence',
          actualValue: `${claim.contradictoryEvidenceIds.length} conflicting sources`,
          remediation: 'Audit source differences and resolve conflicting claims manually.',
          checkedAt
        });
      } else {
        checks.push({
          id: uuidv4(),
          missionId,
          runId,
          ruleId: 'NO_CONTRADICTION',
          name: 'Contradiction Audit',
          status: 'PASS',
          reason: 'No contradictory evidence detected for this claim.',
          claimId: claim.id,
          evidenceId: null,
          expectedValue: '0 contradictions',
          actualValue: '0 contradictions',
          remediation: null,
          checkedAt
        });
      }

      // Rule 6: DEPENDENCY_FRESHNESS
      if (claim.verificationStatus === 'stale') {
        checks.push({
          id: uuidv4(),
          missionId,
          runId,
          ruleId: 'DEPENDENCY_FRESHNESS',
          name: 'Source Dependency Freshness',
          status: 'FAIL',
          reason: `Claim is marked STALE due to detected source drift. Revalidation required.`,
          claimId: claim.id,
          evidenceId: null,
          expectedValue: 'Fresh (unmodified source)',
          actualValue: 'Stale (source drifted)',
          remediation: 'Trigger selective revalidation on this claim.',
          checkedAt
        });
      }
    }

    // Tally verification counts
    let passCount = 0;
    let failCount = 0;
    let uncertainCount = 0;
    let unprovableCount = 0;

    for (const c of checks) {
      if (c.status === 'PASS') passCount++;
      else if (c.status === 'FAIL') failCount++;
      else if (c.status === 'UNCERTAIN') uncertainCount++;
      else if (c.status === 'UNPROVABLE') unprovableCount++;
    }

    // Determine final verdict
    let verdict: VerificationStatus = 'PASS';
    if (failCount > 0) {
      verdict = 'FAIL';
    } else if (unprovableCount > 0) {
      verdict = 'UNPROVABLE';
    } else if (uncertainCount > 0) {
      verdict = 'UNCERTAIN';
    }

    const summary = `Verification Run completed: ${passCount} passed, ${failCount} failed, ${uncertainCount} uncertain, ${unprovableCount} unprovable out of ${checks.length} total checks. Overall verdict: ${verdict}.`;

    const run: VerificationRun = {
      id: runId,
      missionId,
      verdict,
      passCount,
      failCount,
      uncertainCount,
      unprovableCount,
      totalChecks: checks.length,
      summary,
      createdAt: checkedAt
    };

    repo.createVerificationRun(run);
    repo.createVerificationChecks(checks);

    // Update claim verification status based on checks
    for (const claim of claims) {
      if (claim.verificationStatus === 'stale') continue; // keep stale status until revalidation

      const claimChecks = checks.filter(c => c.claimId === claim.id);
      const hasFail = claimChecks.some(c => c.status === 'FAIL');
      const hasUncertain = claimChecks.some(c => c.status === 'UNCERTAIN');
      const hasUnprovable = claimChecks.some(c => c.status === 'UNPROVABLE');

      if (hasFail) {
        repo.updateClaimStatus(claim.id, 'failed');
      } else if (hasUnprovable) {
        repo.updateClaimStatus(claim.id, 'unverifiable');
      } else if (hasUncertain) {
        repo.updateClaimStatus(claim.id, 'pending');
      } else {
        repo.updateClaimStatus(claim.id, 'verified');
      }
    }

    logger.info(`Verification run ${runId} finalized with verdict: ${verdict}`);
    return run;
  }
}

export const verificationEngine = new VerificationEngine();
