
DROP TABLE IF EXISTS jobs;
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,           -- UUID from Frontend/Backend
    status TEXT DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
    input_image_url TEXT,          -- Uploaded Image URL (R2)
    prompt TEXT,
    runpod_id TEXT,                -- Job ID returned from RunPod
    output_image_url TEXT,         -- Result Image URL (R2)
    created_at INTEGER,            -- Unix Timestamp
    updated_at INTEGER
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
