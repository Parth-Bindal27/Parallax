# AdaL Development & Verification Evidence Ledger

## 1. Challenge & Integration Context
This project was developed for the **PARALLAX: Verified Web Missions** challenge involving **AdaL by Sylph**.

### Tooling Availability & Environment Disclosure
- **Development Environment:** macOS (Darwin), Node.js v24.10.9, TypeScript 5.7.3, Playwright 1.64.1, Native `node:sqlite`.
- **AdaL Runtime Status:** Direct AdaL runtime SDK/CLI was not pre-installed or authorized as a local global binary in this development container.
- **Evidence Handling Policy:** In accordance with Section 16 of the Master Specification, **no synthetic or fabricated AdaL tool traces or screenshots are generated**. All logs, tests, Playwright runs, and artifacts documented here represent **genuine, reproducible executions** verified directly against Chromium browser automation and SQLite persistence.
- **Future AdaL Bridge:** PARALLAX includes an LLM and agent provider abstraction (`apps/server/src/providers/providerInterface.ts`). When deploying with an authorized AdaL endpoint, set `LLM_PROVIDER=adal` and provide `LLM_BASE_URL` and `LLM_API_KEY`.

---

## 2. Chronological Engineering Tasks & Evidence

| Task ID | Component | Action Executed | Observed Result | Evidence Artifact Reference |
|---|---|---|---|---|
| `TSK-001` | Architecture Review | Monorepo structure, strict TypeScript, DAG scheduling design | Modular monolith initialized with `@parallax/shared`, `@parallax/server`, `@parallax/web` | `docs/architecture.md` |
| `TSK-002` | Database Persistence | SQLite schema, migration runner, repository layer using Node 24 `node:sqlite` | 13 relational tables created with indexes, zero native compilation friction | `apps/server/src/database/schema.sql` |
| `TSK-003` | Intent Compiler | Natural language compilation into structured `MissionSpecification` and DAG | 8 topological stages created: `discover_sources` -> `finalize_mission` | `tests/unit/intentCompiler.test.ts` (PASS) |
| `TSK-004` | Browser Automation | Playwright Chromium automation with SSRF defense and action event logging | Real headless Chromium loads pages, extracts DOM text, logs timing | `apps/server/src/browser/browserExecutor.ts` |
| `TSK-005` | Evidence Ledger | Exact quotation extractor with DOM locators and SHA-256 content hashing | 20 verifiable claims generated with exact supporting excerpts | `data/snapshots/`, `data/parallax.db` |
| `TSK-006` | Deterministic Verification | 6-rule verification suite evaluating claims without LLM reliance | 85 passed assertions, 0 failures, verdict `PASS` | `apps/server/src/verification/verificationEngine.ts` |
| `TSK-007` | Artifact Generation | CSV, Markdown, JSON, HTML generation with disk readback validation | 4 deliverables written to disk and validated by re-parsing | `tests/integration/artifactReadback.test.ts` (PASS) |
| `TSK-008` | Source Drift Engine | Controlled fixture mutation, line diffing, selective invalidation | StudyPilot AI price updated ₹499 -> ₹699, only 1 claim marked stale | `tests/integration/controlledDriftRevalidation.test.ts` (PASS) |
| `TSK-009` | Selective Revalidation | Re-extracted drifted claim, rerun checks, generated `v2` deliverables | Claim updated to 699, `v2` artifacts generated, `v1` preserved | `data/artifacts/*-v2.csv` |
| `TSK-010` | Web Application UI | 6 responsive screens built with React 18, Tailwind, and `@xyflow/react` | Full interactive workstation with dark mode and React Flow graph | `apps/web/` |
| `TSK-011` | End-to-End Testing | Playwright E2E browser tests simulating full user workflow | 2/2 E2E browser tests passed cleanly in Chromium | `tests/e2e/parallax.spec.ts` (PASS) |

---

## 3. Signature Run Metadata Reference

The signature run execution log is saved at `tests/scripts/run-demo.ts` and can be executed anytime via `npm run demo`. Detailed JSON metadata for the signature run is persisted in `docs/adal-evidence/signature-run-evidence.json`.
