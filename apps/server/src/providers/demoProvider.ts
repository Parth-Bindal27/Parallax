import { z } from 'zod';
import type { LLMProvider } from './providerInterface.js';
import type { MissionSpecification } from '@parallax/shared';
import { logger } from '../observability/logger.js';

export class DemoProvider implements LLMProvider {
  name = 'demo-deterministic-v1';

  isAvailable(): boolean {
    return true;
  }

  async completeStructured<T>(prompt: string, schema: z.ZodSchema<T>, systemPrompt?: string): Promise<T> {
    logger.info(`[DemoProvider] Executing deterministic structured completion for prompt: "${prompt.slice(0, 80)}..."`);

    const lower = prompt.toLowerCase();

    // Default template: Student AI Tools research
    const defaultSpec: MissionSpecification = {
      objective: 'Research five AI tools useful for university students and verify pricing, features, free tier availability, and official URLs against primary source evidence.',
      requiredInputs: ['Target URLs or tool names', 'Extraction schema'],
      expectedOutputs: ['CSV', 'MARKDOWN', 'JSON', 'HTML'],
      constraints: [
        'Only verify claims directly supported by exact source excerpts',
        'Reject inferred or unprovable values',
        'Detect source drift on re-inspection'
      ],
      researchTargets: [
        'StudyPilot AI',
        'ScholarSync',
        'PaperPulse',
        'CiteCraft',
        'QuizForge'
      ],
      sourceRequirements: [
        'Official product pricing pages',
        'Official documentation or homepage features'
      ],
      extractionFields: [
        {
          name: 'monthlyPrice',
          description: 'Standard monthly subscription price in specified currency',
          dataType: 'currency',
          required: true
        },
        {
          name: 'freePlanAvailable',
          description: 'Whether a permanent free plan or tier is offered without payment',
          dataType: 'boolean',
          required: true
        },
        {
          name: 'keyFeatures',
          description: 'Key academic capabilities and student features',
          dataType: 'string',
          required: true
        },
        {
          name: 'officialUrl',
          description: 'Canonical official product homepage URL',
          dataType: 'url',
          required: true
        }
      ],
      verificationRules: [
        {
          ruleId: 'FIELD_REQUIRED',
          description: 'Ensure all required fields (monthlyPrice, freePlanAvailable, officialUrl) are extracted',
          severity: 'critical'
        },
        {
          ruleId: 'EVIDENCE_EXISTS',
          description: 'Ensure each claim references at least one valid evidence record',
          severity: 'critical'
        },
        {
          ruleId: 'EXCERPT_IN_SNAPSHOT',
          description: 'Ensure supporting excerpt text exactly matches text in the captured snapshot',
          severity: 'critical'
        },
        {
          ruleId: 'CURRENCY_NORMALIZATION',
          description: 'Verify currency code (e.g. INR / ₹) and numeric price validity',
          severity: 'critical'
        },
        {
          ruleId: 'NO_CONTRADICTION',
          description: 'Detect conflicting statements across sources for the same entity and field',
          severity: 'warning'
        },
        {
          ruleId: 'ARTIFACT_READBACK',
          description: 'Validate generated CSV rows and Markdown citations by reading back from disk',
          severity: 'critical'
        }
      ],
      artifactRequirements: [
        { type: 'CSV', filename: 'student-ai-tools-comparison.csv' },
        { type: 'MARKDOWN', filename: 'student-ai-tools-verification-report.md' },
        { type: 'JSON', filename: 'student-ai-tools-manifest.json' },
        { type: 'HTML', filename: 'student-ai-tools-audit.html' }
      ],
      dependencies: [
        'Source -> Snapshot -> Evidence -> Claim -> Check -> Artifact'
      ],
      completionCriteria: [
        'All 5 student AI tools visited and snapshotted',
        'Claims extracted with exact supporting quotes',
        'Deterministic verification checks executed',
        'Artifacts generated and validated via readback'
      ],
      approvalRequirements: [
        { actionType: 'FILL', threshold: 'Requires approval under INTERACTIVE_NAVIGATION' }
      ],
      failureHandlingPolicy: 'isolate_and_continue'
    };

    // If prompt mentions custom targets or URL, customize the spec
    if (lower.includes('saas') || lower.includes('pricing') || lower.includes('competitor')) {
      defaultSpec.objective = 'Audit and compare SaaS competitor pricing and feature tiers with verifiable evidence lineage.';
    }

    // Validate with Zod schema before returning
    const parsed = schema.safeParse(defaultSpec);
    if (!parsed.success) {
      throw new Error(`DemoProvider generated specification failed schema validation: ${parsed.error.message}`);
    }

    return parsed.data;
  }
}
