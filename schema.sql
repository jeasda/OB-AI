-- D1 schema
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL,
  runpod_id TEXT,
  result_key TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS job_timestamps (
  job_id TEXT PRIMARY KEY,
  created_at_ms INTEGER NOT NULL,
  submitted_to_runpod_at_ms INTEGER,
  runpod_started_at_ms INTEGER,
  runpod_completed_at_ms INTEGER,
  webhook_received_at_ms INTEGER
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  payload_json TEXT,
  processed_at INTEGER,
  status TEXT
);
CREATE INDEX IF NOT EXISTS webhook_events_job_id_idx ON webhook_events(job_id);

CREATE TABLE IF NOT EXISTS job_metrics (
  job_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  total_duration_ms INTEGER NOT NULL,
  runpod_queue_duration_ms INTEGER,
  runpod_run_duration_ms INTEGER,
  runpod_wait_duration_ms INTEGER,
  end_to_end_duration_ms INTEGER,
  submitted_to_runpod_at_ms INTEGER,
  runpod_started_at_ms INTEGER,
  runpod_completed_at_ms INTEGER,
  webhook_received_at_ms INTEGER,
  cost_estimate_usd REAL,
  created_at TEXT NOT NULL
);
