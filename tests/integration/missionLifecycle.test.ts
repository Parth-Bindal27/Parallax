process.env.ALLOW_LOCAL_FIXTURES = 'true';
process.env.PORT = '3001';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runMigrations } from '../../apps/server/src/database/migrations.js';
import { intentCompiler } from '../../apps/server/src/missions/intentCompiler.js';
import { missionRunner } from '../../apps/server/src/missions/missionRunner.js';
import { repo } from '../../apps/server/src/database/repository.js';
import { fixtureManager } from '../../apps/server/src/fixtures/fixtureServer.js';

describe('Integration - Mission Lifecycle & Verification', () => {
  beforeAll(async () => {
    runMigrations();
    try {
      await fetch('http://localhost:3001/api/v1/fixtures/reset', { method: 'POST' });
    } catch {}
    fixtureManager.resetToBaseline();
  });

  it('runs complete end-to-end mission from prompt to verified artifacts', async () => {
    const prompt = 'Research five AI tools useful for university students. Compare their features, pricing, free plans, and official URLs.';
    const { mission } = await intentCompiler.compile({
      prompt,
      autonomyLevel: 'INTERACTIVE_NAVIGATION'
    });

    expect(mission.status).toBe('planning');

    // Run execution
    await missionRunner.executeMission(mission.id);

    // Verify Mission Status
    const completedMission = repo.getMission(mission.id);
    expect(completedMission?.status).toBe('completed');
    expect(completedMission?.verdict).toBe('PASS');

    // Verify Nodes
    const nodes = repo.getMissionNodes(mission.id);
    expect(nodes.length).toBe(8);
    for (const node of nodes) {
      expect(node.status).toBe('completed');
    }

    // Verify Claims & Evidence
    const claims = repo.getClaims(mission.id);
    expect(claims.length).toBe(20);
    for (const claim of claims) {
      expect(claim.verificationStatus).toBe('verified');
      expect(claim.supportingEvidenceIds.length).toBeGreaterThan(0);
    }

    // Verify Evidence Records
    const evidence = repo.getEvidenceRecords(mission.id);
    expect(evidence.length).toBe(20);
    for (const ev of evidence) {
      expect(ev.validationStatus).toBe('PASS');
      expect(ev.contentFingerprint).toBeDefined();
    }

    // Verify Verification Run
    const runs = repo.getVerificationRuns(mission.id);
    expect(runs.length).toBeGreaterThanOrEqual(1);
    expect(runs[0].verdict).toBe('PASS');
    expect(runs[0].failCount).toBe(0);

    // Verify Artifacts
    const artifacts = repo.getArtifacts(mission.id);
    expect(artifacts.length).toBe(4);
    for (const art of artifacts) {
      expect(art.isValidated).toBe(true);
      expect(art.sizeBytes).toBeGreaterThan(0);
    }
  });
});
