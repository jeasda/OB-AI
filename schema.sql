CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  prompt TEXT,
  model TEXT,
  ratio TEXT,
  image_url TEXT,
  runpod_job_id TEXT,
  output_image_url TEXT,
  error_message TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
