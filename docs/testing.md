# PARALLAX Testing & QA Guide

PARALLAX maintains a multi-tiered test suite ensuring determinism, safety, browser reliability, and lineage integrity.

---

## 1. Test Suite Architecture

```
tests/
├── unit/
│   ├── intentCompiler.test.ts        # Intent parsing and DAG construction
│   ├── driftDetector.test.ts         # Line diffing, content hashing, and diff calculation
│   └── policyEngine.test.ts          # SSRF defenses, URL sanitization, autonomy tiers
├── integration/
│   ├── missionLifecycle.test.ts      # Full prompt-to-verdict execution with Playwright
│   ├── controlledDriftRevalidation.test.ts # Stages A through G signature drift workflow
│   └── artifactReadback.test.ts      # Disk readback validation of CSV, MD, JSON, HTML
├── e2e/
│   └── parallax.spec.ts              # Playwright browser end-to-end tests against UI
└── scripts/
    ├── run-demo.ts                   # Standalone reproducible demonstration runner
    ├── mutate-fixture.ts             # Programmatically trigger price drift on fixture
    └── reset-fixture.ts              # Reset fixture to pristine baseline
```

---

## 2. Test Execution Commands

### Run All Unit & Integration Tests (Vitest)
```bash
npm run test
```
*Executes all 6 test suites across unit and integration targets using Vitest.*

### Run Playwright E2E Browser Tests
```bash
# Ensure server is running on http://localhost:3001
npm run test:e2e
```
*Launches headless Chromium, navigates the web UI, validates live execution, evidence explorer, lineage map, report downloads, and triggers controlled source drift.*

### Run Standalone Signature Demonstration
```bash
npm run demo
```
*Executes the complete 7-stage demonstration (Stages A–G) directly in the terminal, asserting all state transitions.*

---

## 3. Observed Test Results

### Vitest Unit & Integration Suites
```text
 ✓ tests/integration/missionLifecycle.test.ts (1 test)
 ✓ tests/integration/artifactReadback.test.ts (1 test)
 ✓ tests/integration/controlledDriftRevalidation.test.ts (1 test)
 ✓ tests/unit/intentCompiler.test.ts (1 test)
 ✓ tests/unit/driftDetector.test.ts (2 tests)
 ✓ tests/unit/policyEngine.test.ts (4 tests)

 Test Files  6 passed (6)
      Tests  10 passed (10)
   Duration  5.13s
```

### Playwright E2E Browser Suite
```text
Running 2 tests using 1 worker

  ✓ 1: workspace -> launch -> live execution -> evidence -> lineage -> report (834ms)
  ✓ 2: controlled source-drift detection and selective revalidation workflow (1.0s)

  2 passed (2.2s)
```

---

## 4. How to Reproduce the Controlled Source-Drift Experiment

1. **Verify Baseline (Stage A & B):**
   - Start PARALLAX and launch the "5 Student AI Tools" mission.
   - The mission executes, visits `http://localhost:3001/fixtures/student-ai-tools`, captures Snapshot v1, extracts 20 verified claims (StudyPilot AI price = ₹499), and generates v1 artifacts.
   - All 85 verification checks pass with verdict `PASS`.

2. **Trigger Controlled Mutation (Stage C):**
   - In the UI (Lineage Map or Settings screen) or via terminal:
     ```bash
     npm run demo:mutate
     ```
   - This mutates the fixture price for StudyPilot AI from ₹499 to ₹699.

3. **Run Drift Detection (Stage D & E):**
   - Click **"2. Check Source Drift"** in the Lineage Map.
   - The detector compares the new HTML snapshot against Snapshot v1, calculates the line diff (`- ₹499 / month`, `+ ₹699 / month`), and flags **only StudyPilot AI's price claim** as `stale`.
   - Unrelated claims (ScholarSync, PaperPulse, CiteCraft, QuizForge) remain `verified`.

4. **Execute Selective Revalidation (Stage F):**
   - Click **"3. Selective Revalidate"**.
   - The revalidation engine updates the price claim to 699, reruns verification, and regenerates `v2` artifacts on disk (`student-ai-tools-comparison-v2.csv`, `student-ai-tools-verification-report-v2.md`).
   - Prior `v1` deliverables are retained for audit history.

5. **Verify Regression (Stage G):**
   - Running drift detection again on unchanged sources confirms `hasDrift: false` and 0 stale claims.
   - Reset the fixture anytime with:
     ```bash
     npm run demo:reset
     ```
