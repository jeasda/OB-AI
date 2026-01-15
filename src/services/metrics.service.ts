import type { Env } from "../env";
import { logEvent } from "../utils/log";

export type JobMetric = {
  job_id: string;
  status: "completed" | "failed";
  total_duration_ms: number;
  runpod_queue_duration_ms?: number | null;
  runpod_run_duration_ms?: number | null;
  runpod_wait_duration_ms?: number | null;
  end_to_end_duration_ms?: number | null;
  submitted_to_runpod_at_ms?: number | null;
  runpod_started_at_ms?: number | null;
  runpod_completed_at_ms?: number | null;
  webhook_received_at_ms?: number | null;
  cost_estimate_usd?: number | null;
  created_at: string;
};

export async function initMetrics(env: Env) {
  await env.DB.exec(`
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
  `);
  const alter = async (sql: string) => {
    try {
      await env.DB.exec(sql);
    } catch {
      // ignore if column exists
    }
  };
  await alter("ALTER TABLE job_metrics ADD COLUMN runpod_wait_duration_ms INTEGER");
  await alter("ALTER TABLE job_metrics ADD COLUMN end_to_end_duration_ms INTEGER");
  await alter("ALTER TABLE job_metrics ADD COLUMN submitted_to_runpod_at_ms INTEGER");
  await alter("ALTER TABLE job_metrics ADD COLUMN runpod_started_at_ms INTEGER");
  await alter("ALTER TABLE job_metrics ADD COLUMN runpod_completed_at_ms INTEGER");
  await alter("ALTER TABLE job_metrics ADD COLUMN webhook_received_at_ms INTEGER");
}

export async function upsertJobMetric(env: Env, metric: JobMetric) {
  await initMetrics(env);
  await env.DB.prepare(
    `INSERT OR REPLACE INTO job_metrics
     (job_id, status, total_duration_ms, runpod_queue_duration_ms, runpod_run_duration_ms, runpod_wait_duration_ms,
      end_to_end_duration_ms, submitted_to_runpod_at_ms, runpod_started_at_ms, runpod_completed_at_ms, webhook_received_at_ms,
      cost_estimate_usd, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      metric.job_id,
      metric.status,
      metric.total_duration_ms,
      metric.runpod_queue_duration_ms ?? null,
      metric.runpod_run_duration_ms ?? null,
      metric.runpod_wait_duration_ms ?? null,
      metric.end_to_end_duration_ms ?? null,
      metric.submitted_to_runpod_at_ms ?? null,
      metric.runpod_started_at_ms ?? null,
      metric.runpod_completed_at_ms ?? null,
      metric.webhook_received_at_ms ?? null,
      metric.cost_estimate_usd ?? null,
      metric.created_at
    )
    .run();

  logEvent("info", "metrics.job", {
    job_id: metric.job_id,
    status: metric.status,
    total_duration_ms: metric.total_duration_ms,
    env: env.ENVIRONMENT || "local",
  });
}
