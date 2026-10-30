import { v4 as uuidv4 } from 'uuid';
import type {
  Mission,
  MissionNode,
  MissionSpecification,
  AutonomyPolicyLevel
} from '@parallax/shared';
import { MissionSpecificationSchema } from '@parallax/shared';
import { providerFactory } from '../providers/providerFactory.js';
import { repo } from '../database/repository.js';
import { logger } from '../observability/logger.js';

export interface CompileIntentInput {
  prompt: string;
  title?: string;
  autonomyLevel?: AutonomyPolicyLevel;
  targetUrls?: string[];
  enableFixtureOverride?: boolean;
}

export class IntentCompiler {
  async compile(input: CompileIntentInput): Promise<{ mission: Mission; nodes: MissionNode[] }> {
    const provider = providerFactory.getProvider();
    const missionId = uuidv4();
    const now = new Date().toISOString();

    logger.info(`Compiling mission intent for: "${input.prompt}"`, { missionId });

    // Compile specification with structured schema validation
    const spec = await provider.completeStructured<MissionSpecification>(
      input.prompt,
      MissionSpecificationSchema,
      'You are the PARALLAX Intent Compiler. Deconstruct the user research prompt into a strict, verifiable mission specification.'
    );

    // Auto-detect URLs, bare domains, and entity names from prompt or targetUrls
    const detectedTargets: string[] = [];

    // 1. Explicit targetUrls passed in input
    if (input.targetUrls && input.targetUrls.length > 0) {
      for (const t of input.targetUrls) {
        const clean = t.trim();
        if (clean) {
          detectedTargets.push(clean.startsWith('http://') || clean.startsWith('https://') ? clean : `https://${clean}`);
        }
      }
    }

    // 2. Full URLs in prompt: https?://...
    const fullUrls = input.prompt.match(/https?:\/\/[^\s"'<>]+/gi) || [];
    for (const u of fullUrls) {
      detectedTargets.push(u);
    }

    // 3. Domain names in prompt: e.g. github.com, news.ycombinator.com, linear.app, notion.so
    const domainMatches = input.prompt.match(/\b([a-zA-Z0-9-]+\.(?:com|org|net|app|io|ai|dev|co|so|in|edu|gov)(?:\/[^\s"'<>]*)?)\b/gi) || [];
    for (const d of domainMatches) {
      const url = `https://${d}`;
      if (!detectedTargets.some(existing => existing.includes(d))) {
        detectedTargets.push(url);
      }
    }

    // 4. Common entity resolution for tool/company names in prompt
    const lowerPrompt = input.prompt.toLowerCase();
    const ENTITY_MAP: Record<string, string> = {
      'github': 'https://github.com',
      'linear': 'https://linear.app',
      'notion': 'https://notion.so',
      'hackernews': 'https://news.ycombinator.com',
      'hacker news': 'https://news.ycombinator.com',
      'ycombinator': 'https://news.ycombinator.com',
      'supabase': 'https://supabase.com',
      'figma': 'https://figma.com',
      'canva': 'https://canva.com',
      'stripe': 'https://stripe.com',
      'openai': 'https://openai.com',
      'anthropic': 'https://anthropic.com',
      'cursor': 'https://cursor.com',
      'vercel': 'https://vercel.com',
      'cloudflare': 'https://cloudflare.com'
    };

    for (const [entityName, resolvedUrl] of Object.entries(ENTITY_MAP)) {
      if (lowerPrompt.includes(entityName) && !detectedTargets.includes(resolvedUrl)) {
        detectedTargets.push(resolvedUrl);
      }
    }

    if (detectedTargets.length > 0) {
      spec.researchTargets = Array.from(new Set(detectedTargets));
    }

    const title = input.title || `Research & Verify: ${spec.researchTargets.slice(0, 3).join(', ')}${spec.researchTargets.length > 3 ? '...' : ''}`;

    const mission: Mission = {
      id: missionId,
      title,
      rawPrompt: input.prompt,
      status: 'planning',
      autonomyLevel: input.autonomyLevel || 'INTERACTIVE_NAVIGATION',
      spec,
      verdict: null,
      summary: null,
      error: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null
    };

    // Construct the Directed Acyclic Graph (DAG) of nodes
    const nodes: MissionNode[] = [];

    // Node 1: Discover Sources
    const discoverNodeId = uuidv4();
    nodes.push({
      id: discoverNodeId,
      missionId,
      nodeType: 'DISCOVER_SOURCES',
      label: 'Discover Sources',
      description: `Resolve target URLs and verify access policies for ${spec.researchTargets.length} entities`,
      status: 'pending',
      dependencies: [],
      payload: { targets: spec.researchTargets, enableFixtureOverride: input.enableFixtureOverride },
      output: null,
      error: null,
      retries: 0,
      maxRetries: 2,
      startedAt: null,
      completedAt: null
    });

    // Node 2: Visit & Snapshot Sources (depends on discover)
    const visitNodeId = uuidv4();
    nodes.push({
      id: visitNodeId,
      missionId,
      nodeType: 'VISIT_SOURCE',
      label: 'Visit & Inspect Sources',
      description: 'Navigate to target URLs using Playwright browser automation',
      status: 'pending',
      dependencies: [discoverNodeId],
      payload: {},
      output: null,
      error: null,
      retries: 0,
      maxRetries: 2,
      startedAt: null,
      completedAt: null
    });

    // Node 3: Capture Snapshots (depends on visit)
    const snapshotNodeId = uuidv4();
    nodes.push({
      id: snapshotNodeId,
      missionId,
      nodeType: 'CAPTURE_SNAPSHOT',
      label: 'Capture Source Snapshots',
      description: 'Store raw page content, compute SHA-256 fingerprints, and normalize text for drift tracking',
      status: 'pending',
      dependencies: [visitNodeId],
      payload: {},
      output: null,
      error: null,
      retries: 0,
      maxRetries: 2,
      startedAt: null,
      completedAt: null
    });

    // Node 4: Extract Claims & Link Evidence (depends on snapshot)
    const extractNodeId = uuidv4();
    nodes.push({
      id: extractNodeId,
      missionId,
      nodeType: 'EXTRACT_CLAIMS',
      label: 'Extract Structured Claims',
      description: 'Extract fields and anchor each claim to exact source excerpts in the evidence ledger',
      status: 'pending',
      dependencies: [snapshotNodeId],
      payload: { fields: spec.extractionFields },
      output: null,
      error: null,
      retries: 0,
      maxRetries: 2,
      startedAt: null,
      completedAt: null
    });

    // Node 5: Deterministic Verification (depends on extract)
    const verifyNodeId = uuidv4();
    nodes.push({
      id: verifyNodeId,
      missionId,
      nodeType: 'VERIFY_CLAIMS',
      label: 'Execute Verification Rules',
      description: 'Run deterministic rule suite: excerpt matching, currency normalization, contradiction checks, link integrity',
      status: 'pending',
      dependencies: [extractNodeId],
      payload: { rules: spec.verificationRules },
      output: null,
      error: null,
      retries: 0,
      maxRetries: 2,
      startedAt: null,
      completedAt: null
    });

    // Node 6: Generate Artifacts (depends on verify)
    const generateArtifactsNodeId = uuidv4();
    nodes.push({
      id: generateArtifactsNodeId,
      missionId,
      nodeType: 'GENERATE_ARTIFACTS',
      label: 'Generate Deliverable Artifacts',
      description: 'Compile CSV matrix, Markdown research report, JSON manifest, and HTML audit view',
      status: 'pending',
      dependencies: [verifyNodeId],
      payload: { artifactRequirements: spec.artifactRequirements },
      output: null,
      error: null,
      retries: 0,
      maxRetries: 2,
      startedAt: null,
      completedAt: null
    });

    // Node 7: Validate Artifacts (depends on generate artifacts)
    const validateArtifactsNodeId = uuidv4();
    nodes.push({
      id: validateArtifactsNodeId,
      missionId,
      nodeType: 'VALIDATE_ARTIFACTS',
      label: 'Readback Artifact Validation',
      description: 'Read generated files from disk and verify schema integrity, row counts, and citations',
      status: 'pending',
      dependencies: [generateArtifactsNodeId],
      payload: {},
      output: null,
      error: null,
      retries: 0,
      maxRetries: 2,
      startedAt: null,
      completedAt: null
    });

    // Node 8: Final Verdict (depends on validate artifacts)
    const finalVerdictNodeId = uuidv4();
    nodes.push({
      id: finalVerdictNodeId,
      missionId,
      nodeType: 'FINAL_VERDICT',
      label: 'Synthesize Final Verdict',
      description: 'Determine overall PASS / FAIL / UNCERTAIN / UNPROVABLE mission outcome',
      status: 'pending',
      dependencies: [validateArtifactsNodeId],
      payload: {},
      output: null,
      error: null,
      retries: 0,
      maxRetries: 1,
      startedAt: null,
      completedAt: null
    });

    // Persist mission and nodes
    repo.createMission(mission);
    repo.createMissionNodes(nodes);

    repo.createMissionEvent(
      uuidv4(),
      missionId,
      'mission_created',
      { missionId, title: mission.title, status: mission.status },
      now
    );

    repo.createMissionEvent(
      uuidv4(),
      missionId,
      'plan_compiled',
      { missionId, totalNodes: nodes.length, objective: spec.objective },
      now
    );

    logger.info(`Mission ${missionId} created with ${nodes.length} execution nodes`);
    return { mission, nodes };
  }
}

export const intentCompiler = new IntentCompiler();
