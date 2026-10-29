import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type {
  Snapshot,
  EvidenceRecord,
  VerificationStatus
} from '@parallax/shared';
import { repo } from '../database/repository.js';
import { logger } from '../observability/logger.js';

export class EvidenceLedger {
  private snapshotsDir: string;

  constructor() {
    this.snapshotsDir = path.resolve(process.cwd(), process.env.SNAPSHOT_STORAGE_PATH || 'data/snapshots');
    if (!fs.existsSync(this.snapshotsDir)) {
      fs.mkdirSync(this.snapshotsDir, { recursive: true });
    }
  }

  /**
   * Computes SHA-256 content hash
   */
  computeHash(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Stores a new source snapshot with raw storage and normalized text comparison
   */
  async storeSnapshot(params: {
    sourceId: string;
    missionId: string;
    url: string;
    title: string;
    html: string;
    normalizedText: string;
    statusCode: number;
    headers?: Record<string, string>;
  }): Promise<Snapshot> {
    const snapshotId = uuidv4();
    const captureTime = new Date().toISOString();
    const contentHash = this.computeHash(params.normalizedText);

    // Save raw HTML file to disk
    const rawFilename = `snap_${params.sourceId}_${snapshotId}.html`;
    const rawStoragePath = path.join(this.snapshotsDir, rawFilename);
    fs.writeFileSync(rawStoragePath, params.html, 'utf8');

    // Check if there is an existing snapshot for this source
    const previousSnapshot = repo.getLatestSnapshotForSource(params.sourceId);
    let version = 1;
    let hasChangedFromPrevious = false;
    let previousSnapshotId: string | null = null;

    if (previousSnapshot) {
      version = previousSnapshot.version + 1;
      previousSnapshotId = previousSnapshot.id;
      hasChangedFromPrevious = previousSnapshot.contentHash !== contentHash;
      logger.info(`Source ${params.sourceId} snapshot comparison: version ${version}, changed=${hasChangedFromPrevious}`);
    }

    const snapshot: Snapshot = {
      id: snapshotId,
      sourceId: params.sourceId,
      missionId: params.missionId,
      version,
      captureTime,
      contentHash,
      rawStoragePath,
      normalizedText: params.normalizedText,
      title: params.title,
      statusCode: params.statusCode,
      headers: params.headers || {},
      previousSnapshotId,
      hasChangedFromPrevious
    };

    repo.createSnapshot(snapshot);
    logger.info(`Stored snapshot ${snapshotId} for source ${params.sourceId} (version ${version})`);
    return snapshot;
  }

  /**
   * Anchors an extracted claim quotation into an audit-grade evidence record
   */
  createEvidenceRecord(params: {
    missionId: string;
    sourceId: string;
    snapshotId: string;
    url: string;
    pageTitle: string;
    exactExcerpt: string;
    fullText: string;
    evidenceType?: 'quotation' | 'table_cell' | 'metadata' | 'screenshot_ocr';
    headingPath?: string[];
    selector?: string;
  }): EvidenceRecord {
    const evidenceId = uuidv4();
    const retrievalTimestamp = new Date().toISOString();
    const contentFingerprint = this.computeHash(params.exactExcerpt);

    // Locate excerpt in fullText
    const charOffset = params.fullText.indexOf(params.exactExcerpt);
    let surroundingContext = '';

    if (charOffset !== -1) {
      const start = Math.max(0, charOffset - 120);
      const end = Math.min(params.fullText.length, charOffset + params.exactExcerpt.length + 120);
      surroundingContext = `...${params.fullText.slice(start, end)}...`;
    } else {
      surroundingContext = params.exactExcerpt;
    }

    const evidence: EvidenceRecord = {
      id: evidenceId,
      missionId: params.missionId,
      sourceId: params.sourceId,
      snapshotId: params.snapshotId,
      exactExcerpt: params.exactExcerpt,
      surroundingContext,
      locator: {
        selector: params.selector,
        headingPath: params.headingPath,
        charOffset: charOffset !== -1 ? charOffset : undefined,
        textLength: params.exactExcerpt.length
      },
      evidenceType: params.evidenceType || 'quotation',
      contentFingerprint,
      url: params.url,
      pageTitle: params.pageTitle,
      validationStatus: charOffset !== -1 ? 'PASS' : 'UNCERTAIN',
      isContradicted: false,
      retrievalTimestamp,
      lastValidatedTimestamp: retrievalTimestamp
    };

    repo.createEvidenceBatch([evidence]);
    logger.debug(`Created evidence record ${evidenceId} for source ${params.sourceId}`);
    return evidence;
  }
}

export const evidenceLedger = new EvidenceLedger();
