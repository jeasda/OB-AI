-- Job Queue Table
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,                 -- UUID ของ job
  status TEXT NOT NULL,                -- QUEUED | RUNNING | COMPLETED | FAILED

  prompt TEXT NOT NULL,                -- prompt จาก user

  input_image_url TEXT NOT NULL,       -- R2 URL ของภาพต้นฉบับ
  output_image_url TEXT,               -- R2 URL ของภาพที่ gen เสร็จ

  runpod_job_id TEXT,                  -- job id จาก RunPod

  error_message TEXT,                  -- error ถ้ามี

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index เพื่อ query เร็ว
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_runpod ON jobs(runpod_job_id);
