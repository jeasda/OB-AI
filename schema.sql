CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  runpod_job_id TEXT,
  status TEXT,
  prompt TEXT,
  model TEXT,
  ratio TEXT,
  image_url TEXT,
  output_url TEXT,
  result_r2_key TEXT,
  result_url TEXT,
  finished_at TEXT,
  error_message TEXT,
  created_at TEXT,
  updated_at TEXT
);
