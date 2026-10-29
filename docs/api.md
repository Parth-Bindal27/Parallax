# PARALLAX REST API Specification

Base URL: `http://localhost:3001/api/v1`

All responses use standard JSON encoding. Non-2xx responses return `{ "error": "Descriptive message" }`.

---

## 1. System & Health Endpoints

### `GET /health`
Returns runtime diagnostic health status, active LLM provider mode, and fixture state.
- **Response `200 OK`**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "database": "connected",
  "provider": {
    "name": "demo-deterministic-v1",
    "isAvailable": true,
    "mode": "Deterministic Demo Mode"
  },
  "fixtureMutated": false
}
```

### `GET /api/v1/settings`
Returns security configuration, active sandbox policies, and environment parameters without exposing secret tokens.
- **Response `200 OK`**:
```json
{
  "environment": "development",
  "port": 3001,
  "provider": {
    "name": "demo-deterministic-v1",
    "isAvailable": true,
    "mode": "Deterministic Demo Mode"
  },
  "defaultAutonomyLevel": "INTERACTIVE_NAVIGATION",
  "allowLocalFixtures": true,
  "ssrfProtectionEnabled": true,
  "dbPath": "./data/parallax.db",
  "snapshotStoragePath": "./data/snapshots",
  "artifactStoragePath": "./data/artifacts"
}
```

---

## 2. Mission Lifecycle Endpoints

### `POST /api/v1/missions`
Compiles a natural language request into a Mission Specification and execution DAG nodes.
- **Request Body**:
```json
{
  "prompt": "Research five AI tools useful for university students. Compare their features, pricing, free plans, and official URLs.",
  "title": "Student AI Tools Audit",
  "autonomyLevel": "INTERACTIVE_NAVIGATION"
}
```
- **Response `201 Created`**:
```json
{
  "mission": {
    "id": "85b74512-7b6c-4fe9-9595-e830227494bc",
    "title": "Research & Verify: StudyPilot AI, ScholarSync, PaperPulse...",
    "status": "planning",
    "autonomyLevel": "INTERACTIVE_NAVIGATION",
    "createdAt": "2026-10-29T18:18:10.000Z"
  },
  "nodes": [
    { "id": "...", "nodeType": "discover_sources", "status": "pending", "stageIndex": 0 },
    { "id": "...", "nodeType": "visit_sources", "status": "pending", "stageIndex": 1 }
  ]
}
```

### `GET /api/v1/missions`
Lists all historical and active missions.
- **Response `200 OK`**:
```json
{
  "missions": [ ... ]
}
```

### `GET /api/v1/missions/:id`
Retrieves mission details, current verdict, and all execution DAG nodes.
- **Response `200 OK`**:
```json
{
  "mission": { ... },
  "nodes": [ ... ]
}
```

### `POST /api/v1/missions/:id/start`
Starts execution of a compiled mission.
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Mission execution initiated.",
  "missionId": "85b74512-7b6c-4fe9-9595-e830227494bc"
}
```

### `POST /api/v1/missions/:id/pause`
Pauses an active mission.
- **Response `200 OK`**: `{ "success": true, "message": "Mission paused." }`

### `POST /api/v1/missions/:id/resume`
Resumes a paused mission.
- **Response `200 OK`**: `{ "success": true, "message": "Mission resumed." }`

### `POST /api/v1/missions/:id/cancel`
Cancels an active or paused mission.
- **Response `200 OK`**: `{ "success": true, "message": "Mission cancelled." }`

### `GET /api/v1/missions/:id/events`
Server-Sent Events (SSE) stream for real-time telemetry. Emits `node_started`, `node_completed`, `browser_action_completed`, `claim_extracted`, `evidence_created`, `mission_completed`.

---

## 3. Observability & Evidence Endpoints

### `GET /api/v1/missions/:id/browser-actions`
Returns chronological Playwright browser interaction logs.
- **Response `200 OK`**:
```json
{
  "actions": [
    {
      "id": "act-1",
      "actionType": "NAVIGATE",
      "url": "http://localhost:3001/fixtures/student-ai-tools",
      "status": "completed",
      "durationMs": 84,
      "timestamp": "2026-10-29T18:18:11.211Z"
    }
  ]
}
```

### `GET /api/v1/missions/:id/sources`
Lists discovered target sources for the mission.

### `GET /api/v1/missions/:id/snapshots`
Lists captured snapshots, content hashes, and version counts.

### `GET /api/v1/missions/:id/evidence`
Retrieves the persistent evidence ledger for the mission.
- **Response `200 OK`**:
```json
{
  "evidence": [
    {
      "id": "976fa003-cfa6-46e0-a592-a07167d5fb0b",
      "sourceId": "e64909c9-ae9d-42a6-a8ff-c5121c91a2d4",
      "exactExcerpt": "₹499 / month",
      "surroundingContext": "Pricing: ₹499 / month (billed monthly) or ₹399 / month (annual)",
      "url": "http://localhost:3001/fixtures/student-ai-tools",
      "pageTitle": "Verified AI Study Tools for University Students",
      "contentFingerprint": "887a02c5f11...",
      "validationStatus": "PASS"
    }
  ]
}
```

### `GET /api/v1/missions/:id/claims`
Retrieves extracted claims linked to supporting evidence.

---

## 4. Verification & Artifacts Endpoints

### `GET /api/v1/missions/:id/verification`
Retrieves verification runs and rule assertion records.
- **Response `200 OK`**:
```json
{
  "runs": [
    {
      "id": "fe5289bf-1f4e-40cc-855b-10354a70fd19",
      "verdict": "PASS",
      "passCount": 85,
      "failCount": 0,
      "uncertainCount": 0,
      "unprovableCount": 0,
      "summary": "Verification Run completed: 85 passed, 0 failed. Overall verdict: PASS."
    }
  ],
  "latestChecks": [
    {
      "id": "chk-1",
      "ruleId": "EXCERPT_IN_SNAPSHOT",
      "status": "PASS",
      "reason": "Supporting quotation matches snapshot text verbatim."
    }
  ]
}
```

### `GET /api/v1/missions/:id/artifacts`
Lists generated deliverables with version, SHA-256 hash, and file size.

### `GET /api/v1/missions/:id/artifacts/:artifactId/download`
Downloads the verified deliverable file with strict path traversal defenses.
- Supported extensions: `.csv`, `.md`, `.json`, `.html`.

---

## 5. Lineage & Source-Drift Endpoints

### `GET /api/v1/missions/:id/lineage`
Returns the dependency graph (nodes and edges) formatted for React Flow exploration.

### `POST /api/v1/missions/:id/drift/check`
Fetches current source content, diffs against the baseline snapshot, and flags affected claims as stale.
- **Response `200 OK`**:
```json
{
  "report": {
    "id": "drift-rep-1",
    "hasDrift": true,
    "lineDiff": {
      "removed": ["₹499 / month"],
      "added": ["₹699 / month"]
    },
    "staleClaimIds": ["initial-studypilot-price-id"]
  }
}
```

### `POST /api/v1/missions/:id/drift/revalidate`
Runs selective revalidation on affected claims and produces `v2` artifacts.
- **Request Body**: `{ "driftReportId": "drift-rep-1" }`
- **Response `200 OK`**:
```json
{
  "revalidationStatus": "completed",
  "updatedClaims": [
    {
      "subject": "StudyPilot AI",
      "predicate": "monthlyPrice",
      "value": "699",
      "verificationStatus": "verified"
    }
  ]
}
```

---

## 6. Fixture Mutation Endpoints (Local Testing)

### `POST /api/v1/fixtures/mutate`
Modifies the local fixture page content to simulate real web changes.
- **Request Body**: `{ "mutationType": "price_increase" }`
- **Response `200 OK`**: `{ "success": true, "result": { "affectedTool": "StudyPilot AI", "oldPrice": 499, "newPrice": 699 } }`

### `POST /api/v1/fixtures/reset`
Resets the fixture page back to baseline state (`StudyPilot AI = ₹499/mo`).
- **Response `200 OK`**: `{ "success": true, "message": "Fixture reset to baseline state." }`
