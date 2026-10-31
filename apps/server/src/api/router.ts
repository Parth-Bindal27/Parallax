import { Router, type Request, type Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateMissionRequestSchema,
  ResolveApprovalRequestSchema,
  TriggerDriftCheckRequestSchema,
  SelectiveRevalidationRequestSchema
} from '@parallax/shared';
import { repo } from '../database/repository.js';
import { intentCompiler } from '../missions/intentCompiler.js';
import { missionRunner } from '../missions/missionRunner.js';
import { lineageManager } from '../lineage/lineageManager.js';
import { driftDetector } from '../drift/driftDetector.js';
import { fixtureManager, renderFixtureHtml } from '../fixtures/fixtureServer.js';
import { providerFactory } from '../providers/providerFactory.js';
import { gtmGenerator } from '../gtm/gtmGenerator.js';
import { multimodalEngine } from '../multimodal/multimodalEngine.js';
import { policyEngine } from '../policies/policyEngine.js';
import { browserExecutor } from '../browser/browserExecutor.js';
import { verificationEngine } from '../verification/verificationEngine.js';
import { artifactGenerator } from '../artifacts/artifactGenerator.js';
import { logger } from '../observability/logger.js';

export const apiRouter = Router();

// --- HEALTH & READINESS ---
apiRouter.get('/health', (req: Request, res: Response) => {
  try {
    const providerStatus = providerFactory.getProviderStatus();
    res.json({
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      database: 'connected',
      provider: providerStatus,
      fixtureMutated: fixtureManager.isMutated()
    });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', error: String(err) });
  }
});

// --- FIXTURE ROUTES ---
apiRouter.get('/fixtures/student-ai-tools', renderFixtureHtml);

apiRouter.post('/api/v1/fixtures/mutate', (req: Request, res: Response) => {
  try {
    const mutationType = req.body.mutationType || 'price_increase';
    const result = fixtureManager.mutateFixture(mutationType);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.post('/api/v1/fixtures/reset', (req: Request, res: Response) => {
  try {
    fixtureManager.resetToBaseline();
    res.json({ success: true, message: 'Fixture reset to baseline state.' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- MISSIONS ---
apiRouter.post('/api/v1/missions', async (req: Request, res: Response) => {
  try {
    const parsed = CreateMissionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.format() });
    }

    const { mission, nodes } = await intentCompiler.compile(parsed.data);
    res.status(201).json({ mission, nodes });
  } catch (err) {
    logger.error('Failed to create mission', { error: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.get('/api/v1/missions', (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const missions = repo.listMissions(limit);
    res.json({ missions });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.get('/api/v1/missions/:id', (req: Request, res: Response) => {
  try {
    const mission = repo.getMission(req.params.id);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });
    const nodes = repo.getMissionNodes(mission.id);
    res.json({ mission, nodes });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.get('/api/v1/missions/:id/plan', (req: Request, res: Response) => {
  try {
    const nodes = repo.getMissionNodes(req.params.id);
    res.json({ nodes });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.post('/api/v1/missions/:id/start', async (req: Request, res: Response) => {
  try {
    const mission = repo.getMission(req.params.id);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });

    // Launch execution asynchronously
    missionRunner.executeMission(mission.id).catch(err => {
      logger.error(`Error executing mission ${mission.id}`, { error: String(err) });
    });

    res.json({ success: true, message: 'Mission execution initiated', missionId: mission.id });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.post('/api/v1/missions/:id/pause', (req: Request, res: Response) => {
  try {
    missionRunner.pauseMission(req.params.id);
    res.json({ success: true, message: 'Mission execution paused' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.post('/api/v1/missions/:id/resume', (req: Request, res: Response) => {
  try {
    missionRunner.resumeMission(req.params.id);
    res.json({ success: true, message: 'Mission execution resumed' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.post('/api/v1/missions/:id/cancel', (req: Request, res: Response) => {
  try {
    missionRunner.cancelMission(req.params.id);
    res.json({ success: true, message: 'Mission execution cancelled' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- SSE EVENT STREAM ---
apiRouter.get('/api/v1/missions/:id/events', (req: Request, res: Response) => {
  const missionId = req.params.id;
  const since = req.query.since as string | undefined;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send historical events first
  const existingEvents = repo.getMissionEvents(missionId, since);
  for (const ev of existingEvents) {
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  }

  // Subscribe to live events
  const onEvent = (event: any) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  missionRunner.on(`event:${missionId}`, onEvent);

  req.on('close', () => {
    missionRunner.off(`event:${missionId}`, onEvent);
    res.end();
  });
});

// --- ACTION LOGS ---
apiRouter.get('/api/v1/missions/:id/browser-actions', (req: Request, res: Response) => {
  try {
    const actions = repo.getActionLogs(req.params.id);
    res.json({ actions });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- SOURCES & SNAPSHOTS ---
apiRouter.get('/api/v1/missions/:id/sources', (req: Request, res: Response) => {
  try {
    const sources = repo.getSources(req.params.id);
    res.json({ sources });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.get('/api/v1/missions/:id/snapshots', (req: Request, res: Response) => {
  try {
    const snapshots = repo.getSnapshots(req.params.id);
    res.json({ snapshots });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- EVIDENCE & CLAIMS ---
apiRouter.get('/api/v1/missions/:id/evidence', (req: Request, res: Response) => {
  try {
    const evidence = repo.getEvidenceRecords(req.params.id);
    res.json({ evidence });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.get('/api/v1/missions/:id/claims', (req: Request, res: Response) => {
  try {
    const claims = repo.getClaims(req.params.id);
    res.json({ claims });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- LINEAGE GRAPH ---
apiRouter.get('/api/v1/missions/:id/lineage', (req: Request, res: Response) => {
  try {
    const graph = lineageManager.getLineageGraph(req.params.id);
    res.json({ graph });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- VERIFICATION RUNS & CHECKS ---
apiRouter.get('/api/v1/missions/:id/verification', (req: Request, res: Response) => {
  try {
    const runs = repo.getVerificationRuns(req.params.id);
    const checks = runs.length > 0 ? repo.getVerificationChecks(runs[0].id) : [];
    res.json({ runs, latestChecks: checks });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.post('/api/v1/missions/:id/reverify', async (req: Request, res: Response) => {
  try {
    const missionId = req.params.id;
    const run = verificationEngine.executeVerification(missionId);
    await artifactGenerator.generateAndValidateArtifacts(missionId, 1);
    const graph = lineageManager.getLineageGraph(missionId);
    res.json({ success: true, run, graph });
  } catch (err) {
    logger.error('Failed to re-verify mission', { error: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

// --- GTM & CREATIVE STUDIO ---
apiRouter.get('/api/v1/missions/:id/gtm', async (req: Request, res: Response) => {
  try {
    const missionId = req.params.id;
    const gtmPackage = await gtmGenerator.generatePackage(missionId);
    res.json({ gtm: gtmPackage, gtmPackage });
  } catch (err) {
    logger.error('Failed to generate GTM package', { error: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

// --- MULTIMODAL COMPANION CAPABILITIES ---
apiRouter.post('/api/v1/multimodal/generate-image', async (req: Request, res: Response) => {
  try {
    const { missionId, title, headline, subheadline, callToAction, accentColor, dimensions, assetType } = req.body;
    if (!missionId) return res.status(400).json({ error: 'missionId is required' });

    const result = await multimodalEngine.generateMarketingGraphic({
      missionId,
      title: title || 'PARALLAX Asset',
      headline: headline || 'Verified Research Findings',
      subheadline: subheadline || 'Evidence-anchored proof from live browser sessions.',
      callToAction: callToAction || 'Inspect Ledger',
      accentColor,
      dimensions,
      assetType
    });

    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('Failed to generate image asset', { error: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.post('/api/v1/multimodal/generate-audio', async (req: Request, res: Response) => {
  try {
    const { missionId, title, scriptText, durationSeconds } = req.body;
    if (!missionId) return res.status(400).json({ error: 'missionId is required' });

    const result = await multimodalEngine.generateSpeechAudio({
      missionId,
      title: title || 'Product Launch Audio',
      scriptText: scriptText || 'Verified Web Missions audio track.',
      durationSeconds: durationSeconds || 5.0
    });

    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('Failed to synthesize speech audio', { error: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.post('/api/v1/multimodal/upload-image', async (req: Request, res: Response) => {
  try {
    const { missionId, filename, base64Data, mimeType } = req.body;
    if (!missionId || !base64Data) {
      return res.status(400).json({ error: 'missionId and base64Data are required' });
    }

    const cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const safeFilename = filename || 'uploaded_image.png';
    const safeMime = mimeType || 'image/png';

    const result = await multimodalEngine.processUploadedImage(missionId, safeFilename, buffer, safeMime);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('Failed to process image upload', { error: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.post('/api/v1/missions/:id/adal-audit', async (req: Request, res: Response) => {
  try {
    const missionId = req.params.id;
    const auditResult = await multimodalEngine.runAdaLEvaluation(missionId);
    res.json({ success: true, audit: auditResult });
  } catch (err) {
    logger.error('Failed to run AdaL audit', { error: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.get('/api/v1/missions/:id/browser-recording', (req: Request, res: Response) => {
  try {
    const missionId = req.params.id;
    res.json({
      missionId,
      browserRecordingActive: true,
      playbackNote: 'Full Playwright headless Chromium execution viewport captured in audit trail.',
      aiTextToVideoStatus: 'FUTURE_CAPABILITY (Requires external Runway/Sora API key)'
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- ARTIFACTS & DOWNLOADS ---
apiRouter.get('/api/v1/missions/:id/artifacts', (req: Request, res: Response) => {
  try {
    const artifacts = repo.getArtifacts(req.params.id);
    res.json({ artifacts });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Inline view for media (images, audio, HTML)
apiRouter.get('/api/v1/missions/:id/artifacts/:artifactId/view', (req: Request, res: Response) => {
  try {
    const artifact = repo.getArtifactById(req.params.artifactId);
    if (!artifact) return res.status(404).json({ error: 'Artifact not found' });

    const storageDir = path.resolve(process.cwd(), process.env.ARTIFACT_STORAGE_PATH || 'data/artifacts');
    const resolvedPath = path.resolve(artifact.storagePath);
    if (!resolvedPath.startsWith(storageDir)) {
      return res.status(403).json({ error: 'Access denied: path traversal attempt detected' });
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Artifact file missing on disk' });
    }

    res.setHeader('Content-Type', artifact.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${artifact.filename}"`);
    const fileStream = fs.createReadStream(resolvedPath);
    fileStream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.get('/api/v1/missions/:id/artifacts/:artifactId/download', (req: Request, res: Response) => {
  try {
    const artifact = repo.getArtifactById(req.params.artifactId);
    if (!artifact) return res.status(404).json({ error: 'Artifact not found' });

    // Path traversal defense
    const storageDir = path.resolve(process.cwd(), process.env.ARTIFACT_STORAGE_PATH || 'data/artifacts');
    const resolvedPath = path.resolve(artifact.storagePath);
    if (!resolvedPath.startsWith(storageDir)) {
      return res.status(403).json({ error: 'Access denied: path traversal attempt detected' });
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Artifact file missing on disk' });
    }

    res.setHeader('Content-Type', artifact.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${artifact.filename}"`);
    const fileStream = fs.createReadStream(resolvedPath);
    fileStream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- DRIFT & REVALIDATION ---
apiRouter.post('/api/v1/missions/:id/drift/check', async (req: Request, res: Response) => {
  try {
    const missionId = req.params.id;
    const sources = repo.getSources(missionId);
    if (sources.length === 0) return res.status(400).json({ error: 'No sources found for mission' });

    const sourceId = req.body.sourceId || sources[0].id;
    const report = await driftDetector.checkSourceDrift(missionId, sourceId);
    res.json({ report });
  } catch (err) {
    logger.error('Drift check failed', { error: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.post('/api/v1/missions/:id/drift/revalidate', async (req: Request, res: Response) => {
  try {
    const driftReportId = req.body.driftReportId;
    if (!driftReportId) return res.status(400).json({ error: 'driftReportId required' });

    const result = await driftDetector.executeSelectiveRevalidation(driftReportId);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('Selective revalidation failed', { error: String(err) });
    res.status(500).json({ error: String(err) });
  }
});

// --- APPROVALS ---
apiRouter.get('/api/v1/approvals', (req: Request, res: Response) => {
  try {
    const missionId = req.query.missionId as string | undefined;
    if (!missionId) return res.status(400).json({ error: 'missionId query parameter required' });
    const approvals = repo.getApprovals(missionId);
    res.json({ approvals });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.get('/api/v1/screenshots/:filename', (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename);
  const possiblePaths = [
    path.resolve(process.cwd(), 'data/snapshots/screenshots', filename),
    path.resolve(process.cwd(), '../data/snapshots/screenshots', filename),
    path.resolve(process.cwd(), 'apps/server/data/snapshots/screenshots', filename)
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      res.setHeader('Content-Type', 'image/png');
      return res.sendFile(p);
    }
  }
  res.status(404).json({ error: 'Screenshot not found' });
});

apiRouter.post('/api/v1/approvals/:id/resolve', async (req: Request, res: Response) => {
  try {
    const parsed = ResolveApprovalRequestSchema.safeParse({ approvalId: req.params.id, ...req.body });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

    const status = parsed.data.decision === 'approve' ? 'approved' : 'denied';
    repo.resolveApproval(req.params.id, status);

    const missionId = req.body.missionId;
    const targetUrl = req.body.target || 'https://app.linear.app/login';

    // 1. Check if active MissionRunner is waiting on this approval:
    const wasWaiting = missionRunner.resolveApprovalWait(req.params.id, {
      decision: parsed.data.decision,
      formData: parsed.data.formData
    });

    if (missionId) {
      missionRunner.emitMissionEvent(missionId, 'approval_resolved', {
        approvalId: req.params.id,
        status,
        decision: parsed.data.decision,
        humanInputReceived: !!parsed.data.formData
      });
    }

    // 2. If runner was not actively waiting (e.g. simulation, background, or completed mission)
    // and human approved, trigger auto-resumed model browsing:
    if (!wasWaiting && parsed.data.decision === 'approve' && missionId) {
      missionRunner.resumeBrowsingAfterAuth(missionId, targetUrl, parsed.data.formData).catch(err => {
        logger.error('Error during auto-resume browsing in resolve approval', { error: String(err) });
      });
    }

    res.json({ success: true, approvalId: req.params.id, status: parsed.data.decision });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.post('/api/v1/missions/:id/simulate-approval', (req: Request, res: Response) => {
  try {
    const missionId = req.params.id;
    const { actionType, target, reason, riskLevel } = req.body;
    const approval = policyEngine.createApprovalRequest(
      missionId,
      actionType || 'FORM_SUBMIT',
      target || 'https://checkout.stripe.com/pay',
      reason || 'Autonomous agent attempted to submit payment credentials. Autonomy level INTERACTIVE_NAVIGATION blocks unapproved transactions.',
      riskLevel || 'critical'
    );
    missionRunner.emitMissionEvent(missionId, 'approval_requested', { approval });
    res.json({ success: true, approval });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.post('/api/v1/missions/:id/simulate-signin', (req: Request, res: Response) => {
  try {
    const missionId = req.params.id;
    const { targetUrl } = req.body;

    // Find any existing screenshot for visual preview
    const actionLogs = repo.getActionLogs(missionId);
    const lastScreenshot = actionLogs.slice().reverse().find(a => a.screenshotPath)?.screenshotPath;

    const approval = policyEngine.createApprovalRequest(
      missionId,
      'SIGN_IN_REQUIRED',
      targetUrl || 'https://app.linear.app/login',
      'Human Interaction Needed: Target portal requires authentication. Autonomous agent stopped before credential form. Please provide your sign-in credentials or complete login manually to resume.',
      'critical',
      lastScreenshot
    );
    missionRunner.emitMissionEvent(missionId, 'approval_requested', { approval });
    res.json({ success: true, approval });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

apiRouter.post('/api/v1/missions/:id/manual-action', async (req: Request, res: Response) => {
  try {
    const missionId = req.params.id;
    const { actionType, targetUrl, selector } = req.body;
    const actionId = uuidv4();
    const actionLog = {
      actionId,
      missionId,
      actionType: actionType || 'NAVIGATE',
      url: targetUrl || 'http://localhost:3001/fixtures/student-ai-tools',
      selector: selector || null,
      status: 'performed' as const,
      startTime: new Date().toISOString(),
      completionTime: new Date().toISOString()
    };
    repo.createActionLog(actionLog);
    missionRunner.emitMissionEvent(missionId, 'browser_action_executed', { action: actionLog, manual: true });
    res.json({ success: true, action: actionLog });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- SETTINGS ---
apiRouter.get('/api/v1/settings', (req: Request, res: Response) => {
  try {
    const providerStatus = providerFactory.getProviderStatus();
    res.json({
      environment: process.env.NODE_ENV || 'development',
      port: Number(process.env.PORT || 3001),
      provider: providerStatus,
      defaultAutonomyLevel: process.env.DEFAULT_AUTONOMY_LEVEL || 'INTERACTIVE_NAVIGATION',
      allowLocalFixtures: process.env.ALLOW_LOCAL_FIXTURES === 'true',
      ssrfProtectionEnabled: process.env.SSRF_PROTECTION_ENABLED !== 'false',
      databasePath: process.env.DATABASE_PATH || './data/parallax.db',
      snapshotsPath: process.env.SNAPSHOT_STORAGE_PATH || './data/snapshots',
      artifactsPath: process.env.ARTIFACT_STORAGE_PATH || './data/artifacts'
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
