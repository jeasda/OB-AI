import type { Env } from "../env";
import { logEvent } from "../utils/log";

export type JobTimestampRow = {
  job_id: string;
  created_at_ms: number;
  submitted_to_runpod_at_ms?: number | null;
  runpod_started_at_ms?: number | null;
  runpod_completed_at_ms?: number | null;
  webhook_received_at_ms?: number | null;
};

export async function initJobTimestamps(env: Env) {
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS job_timestamps (
      job_id TEXT PRIMARY KEY,
      created_at_ms INTEGER NOT NULL,
      submitted_to_runpod_at_ms INTEGER,
      runpod_started_at_ms INTEGER,
      runpod_completed_at_ms INTEGER,
      webhook_received_at_ms INTEGER
    );
  `);
}

export async function createJobTimestamp(env: Env, row: JobTimestampRow) {
  await initJobTimestamps(env);
  await env.DB.prepare(
    `INSERT OR REPLACE INTO job_timestamps
     (job_id, created_at_ms, submitted_to_runpod_at_ms, runpod_started_at_ms, runpod_completed_at_ms, webhook_received_at_ms)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      row.job_id,
      row.created_at_ms,
      row.submitted_to_runpod_at_ms ?? null,
      row.runpod_started_at_ms ?? null,
      row.runpod_completed_at_ms ?? null,
      row.webhook_received_at_ms ?? null
    )
    .run();
}

export async function updateJobTimestamp(env: Env, jobId: string, fields: Partial<JobTimestampRow>) {
  await initJobTimestamps(env);
  const current = await getJobTimestamp(env, jobId);
  const next: JobTimestampRow = {
    job_id: jobId,
    created_at_ms: current?.created_at_ms || fields.created_at_ms || Date.now(),
    submitted_to_runpod_at_ms: fields.submitted_to_runpod_at_ms ?? current?.submitted_to_runpod_at_ms ?? null,
    runpod_started_at_ms: fields.runpod_started_at_ms ?? current?.runpod_started_at_ms ?? null,
    runpod_completed_at_ms: fields.runpod_completed_at_ms ?? current?.runpod_completed_at_ms ?? null,
    webhook_received_at_ms: fields.webhook_received_at_ms ?? current?.webhook_received_at_ms ?? null,
  };
  await createJobTimestamp(env, next);
  logEvent("info", "job.timestamp.updated", {
    job_id: jobId,
    env: env.ENVIRONMENT || "local",
  });
}

export async function getJobTimestamp(env: Env, jobId: string) {
  await initJobTimestamps(env);
  const res = await env.DB.prepare("SELECT * FROM job_timestamps WHERE job_id = ?")
    .bind(jobId)
    .first();
  return (res as JobTimestampRow) || null;
}
