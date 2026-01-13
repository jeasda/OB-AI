import type { Env } from "../env";

export type JobRow = {
  id: string;
  status: string;
  prompt: string | null;
  model: string | null;
  ratio: string | null;
  image_url: string | null;
  runpod_job_id: string | null;
  output_image_url: string | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
};

export async function createJob(env: Env, row: Partial<JobRow> & { id: string }) {
  const now = Date.now();
  const stmt = env.DB.prepare(
    `INSERT INTO jobs (
      id, status, prompt, model, ratio, image_url, runpod_job_id, output_image_url, error_message, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )`
  ).bind(
    row.id,
    row.status ?? "queued",
    row.prompt ?? null,
    row.model ?? null,
    row.ratio ?? null,
    row.image_url ?? null,
    row.runpod_job_id ?? null,
    row.output_image_url ?? null,
    row.error_message ?? null,
    now,
    now
  );

  await stmt.run();
}

export async function updateJob(env: Env, id: string, patch: Partial<JobRow>) {
  const now = Date.now();
  const fields: string[] = [];
  const values: any[] = [];

  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = ?`);
    values.push(v);
  }
  fields.push("updated_at = ?");
  values.push(now);

  values.push(id);

  const sql = `UPDATE jobs SET ${fields.join(", ")} WHERE id = ?`;
  await env.DB.prepare(sql).bind(...values).run();
}

export async function getJob(env: Env, id: string): Promise<JobRow | null> {
  const r = await env.DB.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(id).first<JobRow>();
  return r ?? null;
}
