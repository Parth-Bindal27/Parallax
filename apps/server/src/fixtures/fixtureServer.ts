import type { Request, Response } from 'express';
import { logger } from '../observability/logger.js';

interface ToolFixture {
  name: string;
  monthlyPrice: number;
  currency: string;
  freePlanAvailable: boolean;
  keyFeatures: string;
  officialUrl: string;
  description: string;
}

const BASELINE_TOOLS: ToolFixture[] = [
  {
    name: 'StudyPilot AI',
    monthlyPrice: 499,
    currency: 'INR',
    freePlanAvailable: true,
    keyFeatures: 'Automated PDF Summarizer, Spaced Repetition Flashcards, Quiz Generator',
    officialUrl: 'http://localhost:3001/fixtures/student-ai-tools#studypilot',
    description: 'Autonomous study buddy designed for university exam prep.'
  },
  {
    name: 'ScholarSync',
    monthlyPrice: 799,
    currency: 'INR',
    freePlanAvailable: true,
    keyFeatures: 'Literature Review Synthesis, Citation Graph Explorer, Matrix Comparison',
    officialUrl: 'http://localhost:3001/fixtures/student-ai-tools#scholarsync',
    description: 'Academic research assistant for graduate thesis writing.'
  },
  {
    name: 'PaperPulse',
    monthlyPrice: 349,
    currency: 'INR',
    freePlanAvailable: false,
    keyFeatures: 'Thesis Structure Outline, Plagiarism Risk Sentinel, Grammarly Alternative',
    officialUrl: 'http://localhost:3001/fixtures/student-ai-tools#paperpulse',
    description: 'Grammar and academic tone enhancement for scholarly papers.'
  },
  {
    name: 'CiteCraft',
    monthlyPrice: 599,
    currency: 'INR',
    freePlanAvailable: true,
    keyFeatures: 'Instant BibTeX / APA / MLA / IEEE Formatter, DOI Resolver, RefManager',
    officialUrl: 'http://localhost:3001/fixtures/student-ai-tools#citecraft',
    description: 'Precision bibliographic compiler with direct DOI auto-fetch.'
  },
  {
    name: 'QuizForge',
    monthlyPrice: 299,
    currency: 'INR',
    freePlanAvailable: true,
    keyFeatures: 'Lecture Audio to Q&A Flashcard Decks, Active Recall Mode, Practice Exams',
    officialUrl: 'http://localhost:3001/fixtures/student-ai-tools#quizforge',
    description: 'Lecture note transcribing and active recall quiz generator.'
  }
];

class FixtureManager {
  private tools: ToolFixture[] = JSON.parse(JSON.stringify(BASELINE_TOOLS));
  private mutationCount = 0;

  getTools(): ToolFixture[] {
    return this.tools;
  }

  resetToBaseline(): void {
    this.tools = JSON.parse(JSON.stringify(BASELINE_TOOLS));
    this.mutationCount = 0;
    logger.info('[FixtureManager] Reset student AI tools fixture to baseline state (StudyPilot AI = ₹499/mo)');
  }

  mutateFixture(type: 'price_increase' | 'feature_removal' | 'terms_update' = 'price_increase'): {
    affectedTool: string;
    oldPrice: number;
    newPrice: number;
    mutationType: string;
  } {
    this.mutationCount++;
    const studyPilot = this.tools.find(t => t.name === 'StudyPilot AI');
    if (!studyPilot) throw new Error('StudyPilot AI not found in fixture');

    const oldPrice = studyPilot.monthlyPrice;
    let newPrice = oldPrice;

    if (type === 'price_increase') {
      newPrice = 699;
      studyPilot.monthlyPrice = newPrice;
      studyPilot.description = 'Autonomous study buddy (Price updated for 2026 academic semester).';
    } else if (type === 'feature_removal') {
      studyPilot.keyFeatures = 'Automated PDF Summarizer, Spaced Repetition Flashcards'; // removed Quiz Generator
    }

    logger.warn(`[FixtureManager] Controlled drift triggered on StudyPilot AI: price changed from ₹${oldPrice} to ₹${newPrice}`);

    return {
      affectedTool: studyPilot.name,
      oldPrice,
      newPrice,
      mutationType: type
    };
  }

  isMutated(): boolean {
    return this.mutationCount > 0;
  }
}

export const fixtureManager = new FixtureManager();

export function renderFixtureHtml(req: Request, res: Response): void {
  const tools = fixtureManager.getTools();
  const isMutated = fixtureManager.isMutated();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Student AI Tools Directory — Official Comparison Portal</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; padding: 40px; margin: 0; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .banner { background: ${isMutated ? '#fef2f2' : '#f0fdf4'}; border: 1px solid ${isMutated ? '#fecaca' : '#bbf7d0'}; color: ${isMutated ? '#991b1b' : '#166534'}; padding: 12px 16px; border-radius: 8px; margin-bottom: 24px; font-weight: 500; }
    h1 { color: #0f172a; margin-top: 0; }
    .tool-card { border-bottom: 1px solid #e2e8f0; padding: 24px 0; }
    .tool-card:last-child { border-bottom: none; }
    .tool-header { display: flex; justify-content: space-between; align-items: baseline; }
    .tool-title { font-size: 20px; font-weight: 700; color: #1e40af; margin: 0; }
    .price-tag { font-size: 22px; font-weight: 800; color: #0f172a; }
    .price-period { font-size: 14px; font-weight: normal; color: #64748b; }
    .badge-free { background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 4px; font-size: 13px; font-weight: 600; margin-left: 8px; }
    .badge-paid { background: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 4px; font-size: 13px; font-weight: 600; margin-left: 8px; }
    .features { margin-top: 8px; color: #334155; }
    .meta { font-size: 13px; color: #64748b; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="banner">
      ${isMutated ? '⚠️ CONTROLLED LOCAL FIXTURE: MUTATED STATE (StudyPilot AI price revised to ₹699)' : '✓ CONTROLLED LOCAL FIXTURE: BASELINE STATE (StudyPilot AI = ₹499)'}
    </div>
    <h1>Top 5 AI Tools for University Students (Verified Catalog)</h1>
    <p>Comprehensive verified catalog of primary AI academic software evaluated for accuracy, student discount tiers, and verified pricing.</p>

    <div class="tool-list">
      ${tools.map(t => `
        <div class="tool-card" id="${t.name.toLowerCase().replace(/\s+/g, '')}">
          <div class="tool-header">
            <h2 class="tool-title">
              ${t.name}
              ${t.freePlanAvailable ? '<span class="badge-free">Free Plan Available</span>' : '<span class="badge-paid">Paid Only</span>'}
            </h2>
            <div class="price-tag">
              ₹${t.monthlyPrice} <span class="price-period">/ month</span>
            </div>
          </div>
          <p class="description">${t.description}</p>
          <div class="features">
            <strong>Key Features:</strong> ${t.keyFeatures}
          </div>
          <div class="meta">
            Official URL: <a href="${t.officialUrl}">${t.officialUrl}</a> | Currency: ${t.currency}
          </div>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}
