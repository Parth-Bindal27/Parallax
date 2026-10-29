# PARALLAX — Verified Web Missions

> **From browser execution to evidence-backed outcomes.**  
> An AI-native browser workspace that transforms natural language web research into verifiable, auditable deliverables with cryptographic lineage tracking, deterministic verification, and automated source-drift detection.

[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-Chromium-green.svg)](https://playwright.dev/)
[![React](https://img.shields.io/badge/React-18-cyan.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v3-38bdf8.svg)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-100%25%20Passing-brightgreen.svg)]()

---

## 1. What is PARALLAX?

Traditional LLM web scrapers and agents suffer from three fundamental problems:
1. **Hallucination & Lack of Auditability:** Factual claims cannot be audited back to exact quotes in the underlying source HTML.
2. **Brittle Reliance on AI for Truth:** LLMs are often asked to evaluate whether they themselves hallucinated, leading to false confidence.
3. **Silent Stale Data (Source Drift):** When a source changes prices or terms after extraction, traditional systems have no way to know which specific conclusions, CSV rows, or report sections have become invalid.

**PARALLAX solves this with a 5-pillar verification engine:**
- **Real Playwright Browser Automation:** Executes permitted actions in a real Chromium browser under strict SSRF and autonomy sandbox policies.
- **Persistent Evidence Ledger:** Every claim links to an auditable evidence record containing the verbatim quotation, surrounding context snippet, DOM selector, timestamp, and SHA-256 content fingerprint.
- **Independent Deterministic Verification:** Evaluates truth via rule-based assertions (`FIELD_REQUIRED`, `EVIDENCE_EXISTS`, `EXCERPT_IN_SNAPSHOT`, `CURRENCY_NORMALIZATION`, `NO_CONTRADICTION`, `ARTIFACT_READBACK`), completely independent of the LLM.
- **Cryptographic Lineage Graph:** A directed acyclic graph linking `Source -> Snapshot -> Evidence -> Claim -> Verification -> Deliverables (CSV/Report)`.
- **Source-Drift Detection & Selective Revalidation:** Re-inspects sources, detects changes via line diffing, flags **only affected claims** as `stale`, and regenerates `v2` deliverables while preserving `v1` audit history.

---

## 2. Core Architecture

```
                           +--------------------------------+
                           |     Natural Language Task      |
                           +---------------+----------------+
                                           |
                                           v
                           +--------------------------------+
                           |        Intent Compiler         |
                           +---------------+----------------+
                                           |
                                           v
                           +--------------------------------+
                           |       Mission DAG Engine       |
                           +---------------+----------------+
                                           |
         +---------------------------------+---------------------------------+
         |                                 |                                 |
         v                                 v                                 v
+------------------+             +-------------------+             +-------------------+
| Browser Executor |             |  Evidence Ledger  |             | Deterministic     |
| (Playwright/SSR) | ----------> | (Snapshots/Quotes)| ----------> | Verifier Engine   |
+------------------+             +-------------------+             +-------------------+
                                           |                                 |
                                           +----------------+----------------+
                                                            |
                                                            v
                                           +---------------------------------+
                                           |  Lineage & Source-Drift Engine  |
                                           +----------------+----------------+
                                                            |
                                                            v
                                           +---------------------------------+
                                           |  Multi-Artifact Generator (v1)  |
                                           |   (CSV, Markdown, JSON, HTML)   |
                                           +---------------------------------+
```

---

## 3. The 6-Screen Workstation UI

The frontend is a dark-mode, high-density research workstation built with React 18, Tailwind CSS, Lucide icons, and `@xyflow/react`:

1. **Mission Workspace (`/`):** Natural language task entry, quick presets, autonomy policy selector (`READ_ONLY_RESEARCH`, `INTERACTIVE_NAVIGATION`, `FORM_INTERACTION`, `HIGH_IMPACT_ACTIONS`), and real-time mission history.
2. **Live Execution (`/missions/:id/live`):** Live DAG node progress, Playwright browser session status, real-time action telemetry log, metric tickers, and interactive human-in-the-loop approval gates.
3. **Evidence Explorer (`/missions/:id/evidence`):** Searchable, filterable quotation ledger displaying exact excerpts, surrounding context, DOM locators, and content fingerprints.
4. **Lineage & Drift Map (`/missions/:id/lineage`):** Interactive React Flow canvas mapping dependencies, highlighting stale nodes with animated glowing borders, with embedded drift mutation and selective revalidation controls.
5. **Verification Report (`/missions/:id/report`):** Executive audit verdict banner (`PASS`, `FAIL`, `UNCERTAIN`, `UNPROVABLE`), detailed rule-by-rule assertion table, and verified download cards for CSV, Markdown, JSON, and HTML.
6. **System Settings (`/settings`):** Active LLM provider diagnostics, secret masking verification, SSRF defense status, and local test fixture controls.

---

## 4. Quickstart Guide

### Prerequisites
- Node.js `v20+` (Tested on Node.js `v24.10.9` with native `node:sqlite`).
- npm `v10+`.

### Installation
```bash
# Clone and install workspace dependencies
git clone <repo-url> parallax
cd parallax
npm install

# Build shared types, backend, and frontend
npm run build
```

### Start Development Server
```bash
# Starts the unified server on port 3001 serving both REST API and React SPA
ALLOW_LOCAL_FIXTURES=true PORT=3001 node apps/server/dist/index.js
```
Open your browser at **`http://localhost:3001`**.

---

## 5. Testing & Verification

PARALLAX includes a 100% green test suite across unit, integration, and Playwright browser E2E workflows.

### Run Unit & Integration Tests (Vitest)
```bash
npm run test
```
*Executes all 6 suites (10 tests) covering Intent Compilation, Drift Detection, Policy Engine, Mission Lifecycle, Artifact Readback, and Controlled Drift Revalidation.*

### Run End-to-End Browser Tests (Playwright)
```bash
npm run test:e2e
```
*Runs headless Chromium testing real user interactions, DAG execution, evidence inspection, lineage map, report downloads, and source drift.*

---

## 6. Signature Demonstration Workflow (Stages A–G)

You can run the complete 7-stage demonstration script directly in the terminal:

```bash
npm run demo
```

### What Happens During the Demo:
1. **Stage A & B (Baseline Verification):**
   - Researches 5 student AI tools: *StudyPilot AI*, *ScholarSync*, *PaperPulse*, *CiteCraft*, *QuizForge*.
   - Navigates via Playwright to the catalog page, takes Snapshot v1, extracts 20 structured claims, binds them to exact quotations, and runs 85 deterministic checks (`PASS`).
   - Generates and validates 4 files on disk: `student-ai-tools-comparison-v1.csv`, `student-ai-tools-verification-report-v1.md`, `student-ai-tools-manifest-v1.json`, `student-ai-tools-audit-v1.html`.
2. **Stage C (Controlled Drift Mutation):**
   - The local fixture is mutated: StudyPilot AI's monthly price changes from **₹499** to **₹699**.
3. **Stage D & E (Drift Detection & Impact Analysis):**
   - Captures Snapshot v2 and performs line-level diffing.
   - Detects `- ₹499 / month` and `+ ₹699 / month`.
   - Traverses the dependency graph: **only StudyPilot AI's price claim** is marked `stale`. The remaining 19 claims remain `verified`.
4. **Stage F (Selective Revalidation):**
   - Re-extracts only the drifted claim, runs verification, and generates `v2` deliverables (`*-v2.csv`, `*-v2.md`).
   - Prior `v1` deliverables remain accessible for historical audit.
5. **Stage G (Regression):**
   - Re-runs drift check on unchanged sources. Confirms `hasDrift = false` with 0 false positives.

Reset the fixture anytime with:
```bash
npm run demo:reset
```

---

## 7. Security & Sandbox Defenses

- **SSRF Defenses:** Blocks private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`), link-local, and cloud metadata (`169.254.169.254`). Local fixture testing requires setting `ALLOW_LOCAL_FIXTURES=true`.
- **Path Traversal Protection:** Artifact download endpoints strictly validate file UUIDs and enforce real-path boundaries within `./data/artifacts`.
- **Secret Redaction:** Logs, frontend responses, and reports scrub API keys, bearer tokens, and session cookies.
- **Untrusted Web Content:** External HTML text is treated strictly as data, never instructions.

---

## 8. Docker Deployment

Deploying with Docker Compose:

```bash
docker compose up -d
```
The application will launch on `http://localhost:3001` with containerized Playwright Chromium, native SQLite database, and persistent storage volumes mapped to `./data`.

---

## 9. Detailed Documentation

- [System Architecture](docs/architecture.md)
- [REST API Reference](docs/api.md)
- [Security Architecture & Threat Model](docs/security.md)
- [Testing & QA Guide](docs/testing.md)
- [Production Deployment Guide](docs/deployment.md)
- [AdaL Development Evidence Ledger](docs/adal-evidence/README.md)
