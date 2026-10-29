# PARALLAX System Architecture

## 1. Overview & Vision
**PARALLAX** is an AI-native browser workspace for **verifiable web missions**. Rather than using a Large Language Model as an unverified oracle, PARALLAX implements a strict **evidence-first execution pipeline**:
1. It compiles a natural language prompt into a typed, structured Mission Specification and Directed Acyclic Graph (DAG).
2. It executes web actions in a real Playwright Chromium browser under strict SSRF and autonomy sandbox policies.
3. It captures cryptographically hashed snapshots (SHA-256) and stores exact supporting excerpts with DOM locators.
4. It extracts structured claims anchored directly to evidence IDs.
5. It validates claims through a deterministic rule suite (completely independent of the LLM).
6. It maintains an auditable dependency graph: `Source -> Snapshot -> Evidence -> Claim -> Check -> Artifact`.
7. It monitors sources for drift, pinpoints affected claims, and triggers selective revalidation without unnecessarily invalidating independent claims.

```
                           +--------------------------------+
                           |     User Natural Language      |
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

## 2. Monorepo Structure

```
parallax/
├── apps/
│   ├── web/                     # React 18 + Vite + Tailwind CSS + React Flow
│   │   ├── src/
│   │   │   ├── api/             # Typed API client connecting to backend
│   │   │   ├── components/      # Workstation layout, navigation, and badges
│   │   │   └── pages/           # 6 primary screens:
│   │   │       ├── MissionWorkspace.tsx
│   │   │       ├── LiveExecution.tsx
│   │   │       ├── EvidenceExplorer.tsx
│   │   │       ├── LineageGraph.tsx
│   │   │       ├── VerificationReport.tsx
│   │   │       └── Settings.tsx
│   └── server/                  # Node.js + Express + Playwright + SQLite
│       ├── src/
│       │   ├── api/             # Versioned REST router (/api/v1/*)
│       │   ├── artifacts/       # CSV, Markdown, JSON, HTML generator + readback
│       │   ├── browser/         # Playwright Chromium executor + action logs
│       │   ├── database/        # Node 24 native SQLite persistence + repository
│       │   ├── drift/           # Source drift detector + selective revalidation
│       │   ├── evidence/        # Snapshot store + evidence ledger
│       │   ├── fixtures/        # Local deterministic HTTP fixture server
│       │   ├── lineage/         # Dependency DAG engine + impact analysis
│       │   ├── missions/        # Intent compiler + DAG scheduler + SSE stream
│       │   ├── observability/   # Structured logger with secret redaction
│       │   ├── policies/        # SSRF sandbox + autonomy policy engine
│       │   ├── providers/       # LLM provider interface + deterministic demo
│       │   ├── verification/    # 6-rule deterministic verification suite
│       │   └── app.ts           # Unified Express application
├── packages/
│   └── shared/                  # Strict TypeScript domain types & schemas
│       └── src/
│           ├── types/           # Mission, Claim, Evidence, Lineage, Artifact
│           ├── schemas/         # Zod schemas for runtime validation
│           └── events/          # Real-time Server-Sent Events definitions
├── tests/
│   ├── unit/                    # Fast isolated rule and parser tests
│   ├── integration/             # Full lifecycle, readback, and drift tests
│   ├── e2e/                     # Playwright browser end-to-end user workflows
│   └── scripts/                 # Standalone reproducible demonstration runner
├── data/
│   ├── parallax.db              # SQLite database (auto-migrated)
│   ├── snapshots/               # Raw HTML snapshots
│   └── artifacts/               # Generated deliverables (v1 & v2 versions)
└── docs/                        # Technical specifications & AdaL evidence
```

---

## 3. Core Modules & Responsibilities

### A. Intent Compiler (`apps/server/src/missions/intentCompiler.ts`)
Converts user prompts into a structured `MissionSpecification`. It produces:
- Research targets (e.g. 5 Student AI Tools).
- Extraction fields (`monthlyPrice`, `freePlanAvailable`, `keyFeatures`, `officialUrl`).
- Verification rule requirements (`FIELD_REQUIRED`, `EVIDENCE_EXISTS`, `EXCERPT_IN_SNAPSHOT`, `CURRENCY_NORMALIZATION`, `NO_CONTRADICTION`, `ARTIFACT_READBACK`).
- Deliverables list (`CSV`, `MARKDOWN`, `JSON`, `HTML`).
- Execution nodes in topological DAG dependency order.

### B. Mission DAG Engine (`apps/server/src/missions/missionRunner.ts`)
Executes an 8-stage pipeline:
1. `discover_sources`: Identifies canonical target URLs.
2. `visit_sources`: Navigates to URLs via Playwright Chromium.
3. `capture_snapshots`: Normalizes DOM text and generates SHA-256 fingerprints.
4. `extract_claims`: Binds extracted values to exact quotation records.
5. `verify_claims`: Runs deterministic verification checks.
6. `generate_artifacts`: Creates CSV, Markdown, JSON, and HTML deliverables.
7. `validate_artifacts`: Reads generated files back from disk to verify headers and schema.
8. `finalize_mission`: Sets mission status, emits summary statistics, and outputs verdict (`PASS`, `FAIL`, `UNCERTAIN`, `UNPROVABLE`).

### C. Browser Executor & Sandbox (`apps/server/src/browser/browserExecutor.ts`)
- Launches headless Chromium via Playwright.
- Intercepts and validates every navigation request via `policyEngine.validateNavigationUrl`.
- Blocks private IPv4/IPv6 ranges (e.g., `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254` AWS/cloud metadata) to eliminate SSRF attack vectors.
- Captures browser console errors, page titles, response status codes, and normalized text.

### D. Evidence Ledger & Snapshot Store (`apps/server/src/evidence/evidenceLedger.ts`)
- Records verbatim excerpts, surrounding context snippets, DOM selectors, and timestamps.
- Generates SHA-256 content hashes to enable fast diffing without losing historical context.

### E. Deterministic Verification Engine (`apps/server/src/verification/verificationEngine.ts`)
Evaluates evidence without relying on AI:
- `FIELD_REQUIRED`: Asserts that all mandatory fields have values.
- `EVIDENCE_EXISTS`: Verifies that a claim has at least one valid supporting evidence record.
- `EXCERPT_IN_SNAPSHOT`: Asserts that the supporting quote exists verbatim inside the captured snapshot.
- `CURRENCY_NORMALIZATION`: Validates currency formats, symbol consistency, and numerical boundaries.
- `NO_CONTRADICTION`: Detects if conflicting values exist for the same subject and field.
- `ARTIFACT_READBACK`: Validates that generated files on disk exist, are non-empty, and conform to the expected format.

### F. Dependency Lineage & Drift Engine (`apps/server/src/drift/driftDetector.ts`)
Maintains typed database edges:
- `Source -> Snapshot`
- `Snapshot -> Evidence`
- `Evidence -> Claim`
- `Claim -> Verification Check`
- `Claim -> CSV Cell / Report Section`

When a source is re-checked:
1. Re-fetches the page and compares the new content hash with the baseline.
2. Performs line-level diffing to pinpoint added and removed content.
3. Identifies the specific claims whose supporting excerpts changed.
4. Marks **only the affected claims** as `stale`. Independent claims remain `verified`.
5. On selective revalidation, updates the stale claim, executes verification checks, regenerates `v2` artifacts, and preserves `v1` deliverables for historical auditability.
