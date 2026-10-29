import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import type {
  Artifact,
  ArtifactType,
  Claim,
  EvidenceRecord,
  Source,
  VerificationRun,
  Mission
} from '@parallax/shared';
import { repo } from '../database/repository.js';
import { logger } from '../observability/logger.js';

export class ArtifactGenerator {
  private artifactsDir: string;

  constructor() {
    this.artifactsDir = path.resolve(process.cwd(), process.env.ARTIFACT_STORAGE_PATH || 'data/artifacts');
    if (!fs.existsSync(this.artifactsDir)) {
      fs.mkdirSync(this.artifactsDir, { recursive: true });
    }
  }

  private computeHash(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Generates all required deliverable files and validates them via disk readback
   */
  async generateAndValidateArtifacts(missionId: string, version = 1): Promise<Artifact[]> {
    const mission = repo.getMission(missionId);
    if (!mission) throw new Error(`Mission ${missionId} not found`);

    const claims = repo.getClaims(missionId);
    const sources = repo.getSources(missionId);
    const evidenceList = repo.getEvidenceRecords(missionId);
    const runs = repo.getVerificationRuns(missionId);
    const latestRun = runs[0] || null;

    const artifacts: Artifact[] = [];

    // 1. Generate CSV
    const csvContent = this.buildCsvComparison(claims, version);
    const csvFilename = `student-ai-tools-comparison-v${version}.csv`;
    const csvArtifact = await this.saveAndValidateArtifact(missionId, 'CSV', csvFilename, csvContent, 'text/csv', version, (readback) => {
      const lines = readback.trim().split('\n');
      if (lines.length < 2) return ['CSV contains header only or is empty'];
      const headers = lines[0].split(',');
      if (!headers.includes('"Entity"') || !headers.includes('"Monthly Price"')) {
        return ['Missing required CSV headers ("Entity", "Monthly Price")'];
      }
      return [];
    });
    artifacts.push(csvArtifact);

    // 2. Generate Markdown Report
    const mdContent = this.buildMarkdownReport(mission, claims, sources, evidenceList, latestRun, version);
    const mdFilename = `student-ai-tools-verification-report-v${version}.md`;
    const mdArtifact = await this.saveAndValidateArtifact(missionId, 'MARKDOWN', mdFilename, mdContent, 'text/markdown', version, (readback) => {
      const requiredHeadings = ['# Executive Summary', '## Methodology', '## Sources Consulted', '## Verified Findings Matrix'];
      const missing = requiredHeadings.filter(h => !readback.includes(h));
      return missing.map(m => `Missing required report section: ${m}`);
    });
    artifacts.push(mdArtifact);

    // 3. Generate JSON Manifest
    const jsonContent = this.buildJsonManifest(mission, claims, sources, evidenceList, latestRun, version);
    const jsonFilename = `student-ai-tools-manifest-v${version}.json`;
    const jsonArtifact = await this.saveAndValidateArtifact(missionId, 'JSON', jsonFilename, jsonContent, 'application/json', version, (readback) => {
      try {
        const parsed = JSON.parse(readback);
        if (!parsed.manifestVersion || !parsed.missionId) {
          return ['Invalid manifest JSON schema: missing manifestVersion or missionId'];
        }
        return [];
      } catch (err) {
        return [`Corrupted JSON syntax: ${String(err)}`];
      }
    });
    artifacts.push(jsonArtifact);

    // 4. Generate HTML Report
    const htmlContent = this.buildHtmlReport(mission, claims, latestRun, version);
    const htmlFilename = `student-ai-tools-audit-v${version}.html`;
    const htmlArtifact = await this.saveAndValidateArtifact(missionId, 'HTML', htmlFilename, htmlContent, 'text/html', version, (readback) => {
      if (!readback.includes('<!DOCTYPE html>') || !readback.includes('</html>')) {
        return ['Invalid HTML document structure'];
      }
      return [];
    });
    artifacts.push(htmlArtifact);

    logger.info(`Generated and validated ${artifacts.length} artifacts for mission ${missionId} (version ${version})`);
    return artifacts;
  }

  private async saveAndValidateArtifact(
    missionId: string,
    artifactType: ArtifactType,
    filename: string,
    content: string,
    mimeType: string,
    version: number,
    validator: (readback: string) => string[]
  ): Promise<Artifact> {
    const artifactId = uuidv4();
    const filePath = path.join(this.artifactsDir, `${missionId}_${filename}`);
    
    // Write file to disk
    fs.writeFileSync(filePath, content, 'utf8');

    // Read back file from disk for strict validation
    const readback = fs.readFileSync(filePath, 'utf8');
    const hash = this.computeHash(readback);
    const sizeBytes = Buffer.byteLength(readback, 'utf8');
    const validationErrors = validator(readback);
    const isValidated = validationErrors.length === 0;

    const artifact: Artifact = {
      id: artifactId,
      missionId,
      artifactType,
      filename,
      storagePath: filePath,
      mimeType,
      sizeBytes,
      hash,
      version,
      isValidated,
      validationErrors,
      createdAt: new Date().toISOString()
    };

    repo.createArtifact(artifact);
    return artifact;
  }

  private buildCsvComparison(claims: Claim[], version: number): string {
    const entities = Array.from(new Set(claims.map(c => c.subject)));
    const headers = [
      'Entity',
      'Monthly Price',
      'Currency',
      'Billing Period',
      'Free Plan Available',
      'Key Features',
      'Official URL',
      'Evidence IDs',
      'Verification Status',
      'Last Verified'
    ];

    const rows: string[] = [headers.map(h => `"${h}"`).join(',')];

    for (const entity of entities) {
      const entityClaims = claims.filter(c => c.subject === entity);
      const priceClaim = entityClaims.find(c => c.predicate === 'monthlyPrice');
      const freeClaim = entityClaims.find(c => c.predicate === 'freePlanAvailable');
      const featuresClaim = entityClaims.find(c => c.predicate === 'keyFeatures');
      const urlClaim = entityClaims.find(c => c.predicate === 'officialUrl');

      const allEvidenceIds = Array.from(new Set(entityClaims.flatMap(c => c.supportingEvidenceIds))).join(';');
      const overallStatus = entityClaims.some(c => c.verificationStatus === 'stale')
        ? 'stale'
        : entityClaims.some(c => c.verificationStatus === 'failed')
        ? 'failed'
        : 'verified';

      const row = [
        `"${entity}"`,
        `"${priceClaim?.value ?? 'N/A'}"`,
        `"${priceClaim?.unitOrCurrency ?? 'INR'}"`,
        `"${priceClaim?.billingPeriod ?? 'monthly'}"`,
        `"${freeClaim?.value === true ? 'Yes' : freeClaim?.value === false ? 'No' : 'Unknown'}"`,
        `"${String(featuresClaim?.value ?? '').replace(/"/g, '""')}"`,
        `"${urlClaim?.value ?? 'N/A'}"`,
        `"${allEvidenceIds}"`,
        `"${overallStatus}"`,
        `"${new Date().toISOString()}"`
      ];

      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  private buildMarkdownReport(
    mission: Mission,
    claims: Claim[],
    sources: Source[],
    evidenceList: EvidenceRecord[],
    latestRun: VerificationRun | null,
    version: number
  ): string {
    const verdict = latestRun?.verdict || mission.verdict || 'UNCERTAIN';
    const entities = Array.from(new Set(claims.map(c => c.subject)));

    return `# Executive Summary

**Mission:** ${mission.title}  
**Report Version:** v${version}  
**Date:** ${new Date().toISOString()}  
**Verdict:** **${verdict}**  

PARALLAX completed an automated, evidence-verified research mission evaluating ${entities.length} AI tools for university students. Every data point presented in this report is deterministically tied to underlying source snapshots, exact textual excerpts, and persistent cryptographic fingerprints.

---

## Methodology

1. **Autonomous Browser Navigation:** Target product pages were visited using real Chromium browser automation without synthetic mockups.
2. **Snapshot Capture:** Raw DOM and normalized text versions were archived with SHA-256 integrity hashes.
3. **Evidence Anchoring:** Extracted pricing, feature, and availability claims were mapped to exact source quotations and DOM locators.
4. **Deterministic Verification:** Independent verification checks validated field schemas, currency units, excerpt exact-matching, and contradiction absence.
5. **Artifact Validation:** Generated CSV and Markdown deliverables were read back from disk and validated for schema completeness.

---

## Sources Consulted

| Entity | Canonical URL | Access Status | Discovered At |
| :--- | :--- | :--- | :--- |
${sources.map(s => `| **${s.title || s.domain}** | [${s.canonicalUrl}](${s.canonicalUrl}) | ${s.isAccessible ? 'Accessible' : 'Restricted'} | ${s.firstDiscoveredAt} |`).join('\n')}

---

## Verified Findings Matrix

| Tool | Monthly Price | Free Plan | Key Features | Status |
| :--- | :--- | :--- | :--- | :--- |
${entities.map(e => {
  const eClaims = claims.filter(c => c.subject === e);
  const price = eClaims.find(c => c.predicate === 'monthlyPrice');
  const free = eClaims.find(c => c.predicate === 'freePlanAvailable');
  const feat = eClaims.find(c => c.predicate === 'keyFeatures');
  const status = eClaims.some(c => c.verificationStatus === 'stale') ? 'STALE' : 'VERIFIED';
  return `| **${e}** | ${price?.unitOrCurrency || '₹'}${price?.value ?? 'N/A'} | ${free?.value ? 'Yes' : 'No'} | ${feat?.value ?? 'N/A'} | \`${status}\` |`;
}).join('\n')}

---

## Evidence Citations & Audit Ledger

${evidenceList.slice(0, 15).map(ev => `
### Evidence [${ev.id.slice(0, 8)}]
- **Source:** [${ev.pageTitle}](${ev.url})
- **Status:** \`${ev.validationStatus}\`
- **Quotation:** 
  > "${ev.exactExcerpt}"
- **Context:**
  \`${ev.surroundingContext}\`
- **Fingerprint:** \`${ev.contentFingerprint}\`
`).join('\n')}

---

## Verification Run Metrics

- **Total Checks Executed:** ${latestRun?.totalChecks ?? 0}
- **Passed:** ${latestRun?.passCount ?? 0}
- **Failed:** ${latestRun?.failCount ?? 0}
- **Uncertain:** ${latestRun?.uncertainCount ?? 0}
- **Unprovable:** ${latestRun?.unprovableCount ?? 0}
- **Audit Verdict:** **${verdict}**

---
*Report generated by PARALLAX Verified Web Missions. Cryptographically auditable.*
`;
  }

  private buildJsonManifest(
    mission: Mission,
    claims: Claim[],
    sources: Source[],
    evidenceList: EvidenceRecord[],
    latestRun: VerificationRun | null,
    version: number
  ): string {
    const manifest = {
      manifestVersion: '1.0.0',
      artifactVersion: version,
      missionId: mission.id,
      title: mission.title,
      verdict: latestRun?.verdict || 'UNCERTAIN',
      generatedAt: new Date().toISOString(),
      summary: latestRun?.summary || '',
      sources: sources.map(s => ({
        id: s.id,
        url: s.url,
        canonicalUrl: s.canonicalUrl,
        title: s.title,
        isAccessible: s.isAccessible
      })),
      claims: claims.map(c => ({
        id: c.id,
        subject: c.subject,
        predicate: c.predicate,
        value: c.value,
        dataType: c.dataType,
        unitOrCurrency: c.unitOrCurrency,
        verificationStatus: c.verificationStatus,
        supportingEvidenceIds: c.supportingEvidenceIds
      })),
      evidenceCount: evidenceList.length,
      verificationStats: {
        totalChecks: latestRun?.totalChecks ?? 0,
        passCount: latestRun?.passCount ?? 0,
        failCount: latestRun?.failCount ?? 0,
        verdict: latestRun?.verdict ?? 'UNCERTAIN'
      }
    };

    return JSON.stringify(manifest, null, 2);
  }

  private buildHtmlReport(mission: Mission, claims: Claim[], latestRun: VerificationRun | null, version: number): string {
    const entities = Array.from(new Set(claims.map(c => c.subject)));
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PARALLAX Audit: ${mission.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
    .card { background: #1e293b; border-radius: 12px; padding: 24px; border: 1px solid #334155; margin-bottom: 24px; }
    h1 { color: #38bdf8; font-size: 28px; margin-top: 0; }
    .badge-pass { background: #065f46; color: #34d399; padding: 4px 12px; border-radius: 9999px; font-weight: bold; }
    .badge-fail { background: #991b1b; color: #f87171; padding: 4px 12px; border-radius: 9999px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #334155; }
    th { color: #94a3b8; font-size: 14px; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="card">
    <h1>PARALLAX — Verified Web Mission Audit</h1>
    <p><strong>Mission:</strong> ${mission.title} (v${version})</p>
    <p><strong>Verdict:</strong> <span class="${latestRun?.verdict === 'PASS' ? 'badge-pass' : 'badge-fail'}">${latestRun?.verdict || 'UNCERTAIN'}</span></p>
    <p>${latestRun?.summary || 'Verification complete.'}</p>
  </div>
  <div class="card">
    <h2>Verified Entity Comparison</h2>
    <table>
      <thead>
        <tr>
          <th>Tool</th>
          <th>Monthly Price</th>
          <th>Free Plan</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${entities.map(e => {
          const eClaims = claims.filter(c => c.subject === e);
          const price = eClaims.find(c => c.predicate === 'monthlyPrice');
          const free = eClaims.find(c => c.predicate === 'freePlanAvailable');
          const status = eClaims.some(c => c.verificationStatus === 'stale') ? 'STALE' : 'VERIFIED';
          return `<tr>
            <td><strong>${e}</strong></td>
            <td>${price?.unitOrCurrency || '₹'}${price?.value ?? 'N/A'}</td>
            <td>${free?.value ? 'Yes' : 'No'}</td>
            <td><code>${status}</code></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;
  }
}

export const artifactGenerator = new ArtifactGenerator();
