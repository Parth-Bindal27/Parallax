import { describe, it, expect } from 'vitest';
import { IntentCompiler } from '../../apps/server/src/missions/intentCompiler.js';
import { runMigrations } from '../../apps/server/src/database/migrations.js';

describe('IntentCompiler - Specification & DAG Compilation', () => {
  runMigrations();
  const compiler = new IntentCompiler();

  it('compiles natural language prompt into a valid MissionSpecification and DAG nodes', async () => {
    const prompt = 'Research five AI tools useful for university students. Compare their features, pricing, free plans, and official URLs.';
    const result = await compiler.compile({ prompt, autonomyLevel: 'INTERACTIVE_NAVIGATION' });

    expect(result.mission).toBeDefined();
    expect(result.mission.id).toBeDefined();
    expect(result.mission.spec.researchTargets.length).toBe(5);
    expect(result.mission.spec.expectedOutputs).toContain('CSV');
    expect(result.mission.spec.expectedOutputs).toContain('MARKDOWN');
    expect(result.mission.spec.expectedOutputs).toContain('JSON');

    // Assert DAG nodes
    expect(result.nodes.length).toBe(8);
    const nodeTypes = result.nodes.map(n => n.nodeType);
    expect(nodeTypes).toEqual([
      'DISCOVER_SOURCES',
      'VISIT_SOURCE',
      'CAPTURE_SNAPSHOT',
      'EXTRACT_CLAIMS',
      'VERIFY_CLAIMS',
      'GENERATE_ARTIFACTS',
      'VALIDATE_ARTIFACTS',
      'FINAL_VERDICT'
    ]);

    // Assert DAG dependencies
    const visitNode = result.nodes.find(n => n.nodeType === 'VISIT_SOURCE');
    const discoverNode = result.nodes.find(n => n.nodeType === 'DISCOVER_SOURCES');
    expect(visitNode?.dependencies).toContain(discoverNode?.id);
  });
});
