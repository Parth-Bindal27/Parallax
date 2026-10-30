import { z } from 'zod';

export const AutonomyPolicyLevelSchema = z.enum([
  'READ_ONLY_RESEARCH',
  'INTERACTIVE_NAVIGATION',
  'FORM_INTERACTION',
  'HIGH_IMPACT_ACTIONS'
]);

export const VerificationStatusSchema = z.enum([
  'PASS',
  'FAIL',
  'UNCERTAIN',
  'UNPROVABLE'
]);

export const ArtifactTypeSchema = z.enum(['CSV', 'MARKDOWN', 'JSON', 'HTML']);

export const CreateMissionRequestSchema = z.object({
  prompt: z.string().min(3, 'Prompt must be at least 3 characters long'),
  title: z.string().optional(),
  autonomyLevel: AutonomyPolicyLevelSchema.default('INTERACTIVE_NAVIGATION'),
  targetUrls: z.array(z.string()).optional(),
  enableFixtureOverride: z.boolean().optional()
});

export const ResolveApprovalRequestSchema = z.object({
  approvalId: z.string().uuid(),
  decision: z.enum(['approve', 'deny']),
  reason: z.string().optional()
});

export const TriggerDriftCheckRequestSchema = z.object({
  sourceId: z.string().uuid().optional(),
  mutateFixture: z.boolean().optional(),
  fixtureMutationType: z.enum(['price_increase', 'feature_removal', 'terms_update']).optional()
});

export const SelectiveRevalidationRequestSchema = z.object({
  driftReportId: z.string().uuid()
});

export const MissionSpecificationSchema = z.object({
  objective: z.string(),
  requiredInputs: z.array(z.string()),
  expectedOutputs: z.array(ArtifactTypeSchema),
  constraints: z.array(z.string()),
  researchTargets: z.array(z.string()),
  sourceRequirements: z.array(z.string()),
  extractionFields: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      dataType: z.enum(['string', 'number', 'boolean', 'url', 'currency']),
      required: z.boolean()
    })
  ),
  verificationRules: z.array(
    z.object({
      ruleId: z.string(),
      description: z.string(),
      severity: z.enum(['critical', 'warning'])
    })
  ),
  artifactRequirements: z.array(
    z.object({
      type: ArtifactTypeSchema,
      filename: z.string()
    })
  ),
  dependencies: z.array(z.string()),
  completionCriteria: z.array(z.string()),
  approvalRequirements: z.array(
    z.object({
      actionType: z.string(),
      threshold: z.string()
    })
  ),
  failureHandlingPolicy: z.enum(['abort_mission', 'isolate_and_continue'])
});
