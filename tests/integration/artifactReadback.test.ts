process.env.ALLOW_LOCAL_FIXTURES = 'true';
process.env.PORT = '3001';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import { runMigrations } from '../../apps/server/src/database/migrations.js';
import { intentCompiler } from '../../apps/server/src/missions/intentCompiler.js';
import { missionRunner } from '../../apps/server/src/missions/missionRunner.js';
import { repo } from '../../apps/server/src/database/repository.js';
import { fixtureManager } from '../../apps/server/src/fixtures/fixtureServer.js';
import { ensureTestServer, closeTestServer } from '../setup/testServer.js';

describe('Integration - Artifact Generation & Disk Readback Validation', () => {
  beforeAll(async () => {
    await ensureTestServer();
    runMigrations();
    fixtureManager.resetToBaseline();
  });

  afterAll(async () => {
    await closeTestServer();
  });

  it('generates files on disk that pass strict readback schema validation', async () => {
    const prompt = 'Research five AI tools useful for university students. Compare their features, pricing, free plans, and official URLs.';
    const { mission } = await intentCompiler.compile({
      prompt,
      autonomyLevel: 'INTERACTIVE_NAVIGATION'
    });

    await missionRunner.executeMission(mission.id);

    const artifacts = repo.getArtifacts(mission.id);
    expect(artifacts.length).toBeGreaterThanOrEqual(4);

    for (const art of artifacts) {
      expect(fs.existsSync(art.storagePath)).toBe(true);
      const content = fs.readFileSync(art.storagePath, 'utf8');

      if (art.artifactType === 'CSV') {
        const rows = content.trim().split('\n');
        expect(rows.length).toBeGreaterThanOrEqual(6); // header + 5 tools
        expect(rows[0]).toContain('Entity');
        expect(rows[0]).toContain('Monthly Price');
      } else if (art.artifactType === 'MARKDOWN') {
        expect(content).toContain('# Executive Summary');
        expect(content).toContain('## Sources Consulted');
        expect(content).toContain('## Verified Findings Matrix');
      } else if (art.artifactType === 'JSON') {
        const parsed = JSON.parse(content);
        expect(parsed.manifestVersion).toBe('1.0.0');
        expect(parsed.missionId).toBe(mission.id);
      } else if (art.artifactType === 'HTML') {
        expect(content).toContain('<!DOCTYPE html>');
        expect(content).toContain('PARALLAX — Verified Web Mission Audit');
      }
    }
  });
});
