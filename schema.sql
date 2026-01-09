CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  runpod_job_id TEXT,
  status TEXT,
  prompt TEXT,
  image_url TEXT,
  output_url TEXT,
  created_at TEXT,
  updated_at TEXT
);
