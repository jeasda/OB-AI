import type { Env } from "../env";
import { createJobTimestamp } from "./job_timestamps.service";

export type JobRow = {
  id: string;
  created_at: string;
  status: "queued" | "running" | "completed" | "failed";
  runpod_id?: string | null;
  result_key?: string | null;
  error?: string | null;
};

export async function initDb(env: Env) {
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL,
      runpod_id TEXT,
      result_key TEXT,
      error TEXT
    );
  `);
}

export async function createJob(env: Env): Promise<JobRow> {
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const createdAtMs = Date.now();
  const status: JobRow["status"] = "queued";
  await env.DB.prepare(
    "INSERT INTO jobs (id, created_at, status) VALUES (?, ?, ?)"
  ).bind(id, created_at, status).run();
  await createJobTimestamp(env, {
    job_id: id,
    created_at_ms: createdAtMs,
  });
  return { id, created_at, status };
}

export async function setRunPodId(env: Env, id: string, runpodId: string) {
  await env.DB.prepare("UPDATE jobs SET runpod_id = ?, status = 'running' WHERE id = ?")
    .bind(runpodId, id).run();
}

export async function completeJob(env: Env, id: string, resultKey: string) {
  await env.DB.prepare("UPDATE jobs SET status = 'completed', result_key = ?, error = NULL WHERE id = ?")
    .bind(resultKey, id).run();
}

export async function failJob(env: Env, id: string, error: string) {
  await env.DB.prepare("UPDATE jobs SET status = 'failed', error = ? WHERE id = ?")
    .bind(error, id).run();
}

export async function getJob(env: Env, id: string): Promise<JobRow | null> {
  const res = await env.DB.prepare("SELECT * FROM jobs WHERE id = ?").bind(id).first();
  return (res as any) || null;
}

export async function getJobByRunpodId(env: Env, runpodId: string): Promise<JobRow | null> {
  const res = await env.DB.prepare("SELECT * FROM jobs WHERE runpod_id = ?").bind(runpodId).first();
  return (res as any) || null;
}
