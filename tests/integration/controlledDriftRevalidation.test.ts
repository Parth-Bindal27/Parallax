process.env.ALLOW_LOCAL_FIXTURES = 'true';
process.env.PORT = '3001';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runMigrations } from '../../apps/server/src/database/migrations.js';
import { intentCompiler } from '../../apps/server/src/missions/intentCompiler.js';
import { missionRunner } from '../../apps/server/src/missions/missionRunner.js';
import { driftDetector } from '../../apps/server/src/drift/driftDetector.js';
import { repo } from '../../apps/server/src/database/repository.js';
import { fixtureManager } from '../../apps/server/src/fixtures/fixtureServer.js';
import { ensureTestServer, closeTestServer } from '../setup/testServer.js';

describe('Integration - Controlled Source Drift & Selective Revalidation (Stages A-G)', () => {
  beforeAll(async () => {
    await ensureTestServer();
    runMigrations();
    try {
      await fetch('http://localhost:3001/api/v1/fixtures/reset', { method: 'POST' });
    } catch {}
    fixtureManager.resetToBaseline();
  });

  afterAll(async () => {
    await closeTestServer();
  });

  it('executes full signature drift scenario: baseline -> mutate -> detect -> impact -> revalidate -> regression', async () => {
    // Stage A & B: Baseline mission
    const prompt = 'Research five AI tools useful for university students. Compare their features, pricing, free plans, and official URLs.';
    const { mission } = await intentCompiler.compile({
      prompt,
      autonomyLevel: 'INTERACTIVE_NAVIGATION'
    });

    await missionRunner.executeMission(mission.id);

    const initialClaims = repo.getClaims(mission.id);
    const initialStudyPilotPrice = initialClaims.find(c => c.subject === 'StudyPilot AI' && c.predicate === 'monthlyPrice');
    expect(Number(initialStudyPilotPrice?.value)).toBe(499);
    expect(initialStudyPilotPrice?.verificationStatus).toBe('verified');

    const sources = repo.getSources(mission.id);
    expect(sources.length).toBeGreaterThan(0);
    const sourceId = sources[0].id;

    // Stage C: Controlled Drift Mutation
    try {
      await fetch('http://localhost:3001/api/v1/fixtures/mutate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mutationType: 'price_increase' })
      });
    } catch {}
    fixtureManager.resetToBaseline();
    const mutation = fixtureManager.mutateFixture('price_increase');
    expect(mutation.oldPrice).toBe(499);
    expect(mutation.newPrice).toBe(699);

    // Stage D: Drift Detection
    const driftReport = await driftDetector.checkSourceDrift(mission.id, sourceId);
    expect(driftReport.hasDrift).toBe(true);
    expect(driftReport.lineDiff.removed).toContain('₹499 / month');
    expect(driftReport.lineDiff.added).toContain('₹699 / month');

    // Stage E: Impact Analysis
    // Crucial check: ONLY StudyPilot AI price claim must be stale
    expect(driftReport.staleClaimIds).toContain(initialStudyPilotPrice?.id);
    expect(driftReport.staleClaimIds.length).toBe(1);

    const updatedClaimsAfterDrift = repo.getClaims(mission.id);
    const staleClaim = updatedClaimsAfterDrift.find(c => c.id === initialStudyPilotPrice?.id);
    expect(staleClaim?.verificationStatus).toBe('stale');

    // Confirm unrelated claims remain verified
    const scholarSyncPrice = updatedClaimsAfterDrift.find(c => c.subject === 'ScholarSync' && c.predicate === 'monthlyPrice');
    expect(scholarSyncPrice?.verificationStatus).toBe('verified');

    // Stage F: Selective Revalidation
    const revalidationResult = await driftDetector.executeSelectiveRevalidation(driftReport.id);
    expect(revalidationResult.revalidationStatus || revalidationResult.driftReport.revalidationStatus).toBe('completed');
    expect(revalidationResult.updatedClaims[0].subject).toBe('StudyPilot AI');
    expect(Number(revalidationResult.updatedClaims[0].value)).toBe(699);
    expect(revalidationResult.updatedClaims[0].verificationStatus).toBe('verified');

    // Confirm v2 artifacts were generated and validated
    const allArtifacts = repo.getArtifacts(mission.id);
    const v1Artifacts = allArtifacts.filter(a => a.version === 1);
    const v2Artifacts = allArtifacts.filter(a => a.version === 2);
    expect(v1Artifacts.length).toBe(4);
    expect(v2Artifacts.length).toBe(4);

    // Stage G: Regression Test (run again on unchanged source)
    const regressionReport = await driftDetector.checkSourceDrift(mission.id, sourceId);
    expect(regressionReport.hasDrift).toBe(false);
    expect(regressionReport.staleClaimIds.length).toBe(0);
    expect(regressionReport.lineDiff.added.length).toBe(0);
    expect(regressionReport.lineDiff.removed.length).toBe(0);
  });
});
