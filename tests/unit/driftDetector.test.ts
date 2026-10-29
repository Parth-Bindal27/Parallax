import { describe, it, expect } from 'vitest';
import { DriftDetector } from '../../apps/server/src/drift/driftDetector.js';

describe('DriftDetector - Diff & Change Computation', () => {
  const detector = new DriftDetector();

  it('detects added and removed lines accurately between two texts', () => {
    const oldText = `
Product: StudyPilot AI
Price: ₹499 / month
Free Plan: Available
Features: PDF Summarizer, Spaced Repetition
    `.trim();

    const newText = `
Product: StudyPilot AI
Price: ₹699 / month
Free Plan: Available
Features: PDF Summarizer, Spaced Repetition
    `.trim();

    const diff = detector.computeLineDiff(oldText, newText);

    expect(diff.removed).toContain('Price: ₹499 / month');
    expect(diff.added).toContain('Price: ₹699 / month');
    expect(diff.removed).not.toContain('Free Plan: Available');
    expect(diff.added).not.toContain('Free Plan: Available');
  });

  it('returns empty added/removed lists when source text is unchanged', () => {
    const text = `
Product: ScholarSync
Price: ₹799 / month
Free Plan: Available
    `.trim();

    const diff = detector.computeLineDiff(text, text);

    expect(diff.added.length).toBe(0);
    expect(diff.removed.length).toBe(0);
  });
});
