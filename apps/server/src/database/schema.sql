-- PARALLAX Core Database Schema

CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  raw_prompt TEXT NOT NULL,
  status TEXT NOT NULL,
  autonomy_level TEXT NOT NULL,
  spec_json TEXT NOT NULL,
  verdict TEXT,
  summary TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_created_at ON missions(created_at);

CREATE TABLE IF NOT EXISTS mission_nodes (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  dependencies_json TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  output_json TEXT,
  error TEXT,
  retries INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY(mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_nodes_mission ON mission_nodes(mission_id);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON mission_nodes(status);

CREATE TABLE IF NOT EXISTS mission_events (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  type TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY(mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_mission ON mission_events(mission_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON mission_events(timestamp);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  url TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  domain TEXT NOT NULL,
  title TEXT,
  is_permitted INTEGER NOT NULL DEFAULT 1,
  is_accessible INTEGER NOT NULL DEFAULT 1,
  first_discovered_at TEXT NOT NULL,
  last_checked_at TEXT NOT NULL,
  FOREIGN KEY(mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sources_mission ON sources(mission_id);
CREATE INDEX IF NOT EXISTS idx_sources_url ON sources(url);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  capture_time TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  raw_storage_path TEXT,
  normalized_text TEXT NOT NULL,
  title TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 200,
  headers_json TEXT NOT NULL,
  previous_snapshot_id TEXT,
  has_changed_from_previous INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE CASCADE,
  FOREIGN KEY(mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshots_source ON snapshots(source_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_mission ON snapshots(mission_id);

CREATE TABLE IF NOT EXISTS evidence_records (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  exact_excerpt TEXT NOT NULL,
  surrounding_context TEXT NOT NULL,
  locator_json TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  content_fingerprint TEXT NOT NULL,
  url TEXT NOT NULL,
  page_title TEXT NOT NULL,
  validation_status TEXT NOT NULL,
  is_contradicted INTEGER NOT NULL DEFAULT 0,
  retrieval_timestamp TEXT NOT NULL,
  last_validated_timestamp TEXT NOT NULL,
  FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE CASCADE,
  FOREIGN KEY(snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY(mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evidence_mission ON evidence_records(mission_id);
CREATE INDEX IF NOT EXISTS idx_evidence_snapshot ON evidence_records(snapshot_id);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  value_json TEXT,
  data_type TEXT NOT NULL,
  unit_or_currency TEXT,
  billing_period TEXT,
  supporting_evidence_ids_json TEXT NOT NULL,
  contradictory_evidence_ids_json TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  verification_status TEXT NOT NULL,
  extracted_at TEXT NOT NULL,
  last_verified_at TEXT,
  notes TEXT,
  FOREIGN KEY(mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_claims_mission ON claims(mission_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(verification_status);

CREATE TABLE IF NOT EXISTS dependency_edges (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  edge_type TEXT NOT NULL,
  is_stale INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY(mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_edges_mission ON dependency_edges(mission_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON dependency_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON dependency_edges(target_node_id);

CREATE TABLE IF NOT EXISTS verification_runs (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  verdict TEXT NOT NULL,
  pass_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  uncertain_count INTEGER NOT NULL DEFAULT 0,
  unprovable_count INTEGER NOT NULL DEFAULT 0,
  total_checks INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_verif_runs_mission ON verification_runs(mission_id);

CREATE TABLE IF NOT EXISTS verification_checks (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  claim_id TEXT,
  evidence_id TEXT,
  expected_value TEXT,
  actual_value TEXT,
  remediation TEXT,
  checked_at TEXT NOT NULL,
  FOREIGN KEY(mission_id) REFERENCES missions(id) ON DELETE CASCADE,
  FOREIGN KEY(run_id) REFERENCES verification_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_verif_checks_run ON verification_checks(run_id);
CREATE INDEX IF NOT EXISTS idx_verif_checks_claim ON verification_checks(claim_id);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  hash TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_validated INTEGER NOT NULL DEFAULT 0,
  validation_errors_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_artifacts_mission ON artifacts(mission_id);

CREATE TABLE IF NOT EXISTS action_logs (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  url TEXT NOT NULL,
  selector TEXT,
  input_value TEXT,
  start_time TEXT NOT NULL,
  completion_time TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  screenshot_path TEXT,
  source_id TEXT,
  evidence_id TEXT,
  FOREIGN KEY(mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_actions_mission ON action_logs(mission_id);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target TEXT NOT NULL,
  reason TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT,
  FOREIGN KEY(mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_approvals_mission ON approvals(mission_id);

CREATE TABLE IF NOT EXISTS drift_reports (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  old_snapshot_id TEXT NOT NULL,
  new_snapshot_id TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  has_drift INTEGER NOT NULL,
  line_diff_json TEXT NOT NULL,
  field_changes_json TEXT NOT NULL,
  stale_claim_ids_json TEXT NOT NULL,
  stale_evidence_ids_json TEXT NOT NULL,
  affected_checks_json TEXT NOT NULL,
  affected_artifacts_json TEXT NOT NULL,
  revalidation_status TEXT NOT NULL,
  FOREIGN KEY(mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_drift_mission ON drift_reports(mission_id);
