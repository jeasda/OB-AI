import type { Env } from "../env";
import { logEvent } from "../utils/log";

export type WebhookEventRow = {
  id: string;
  job_id: string;
  event_type: string;
  received_at: number;
  payload_json: string;
  processed_at?: number | null;
  status?: string | null;
};

export async function initWebhookEvents(env: Env) {
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      received_at INTEGER NOT NULL,
      payload_json TEXT,
      processed_at INTEGER,
      status TEXT
    );
  `);
  await env.DB.exec(`CREATE INDEX IF NOT EXISTS webhook_events_job_id_idx ON webhook_events(job_id);`);
}

export async function insertWebhookEvent(env: Env, row: WebhookEventRow) {
  await initWebhookEvents(env);
  const res = await env.DB.prepare(
    `INSERT OR IGNORE INTO webhook_events (id, job_id, event_type, received_at, payload_json, processed_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      row.id,
      row.job_id,
      row.event_type,
      row.received_at,
      row.payload_json,
      row.processed_at ?? null,
      row.status ?? null
    )
    .run();

  const changes = (res as any)?.meta?.changes ?? 0;
  if (changes === 0) {
    logEvent("info", "webhook.duplicate", {
      job_id: row.job_id,
      event_type: row.event_type,
      env: env.ENVIRONMENT || "local",
    });
    return { inserted: false };
  }
  return { inserted: true };
}

export async function markWebhookProcessed(env: Env, id: string, status: string) {
  await initWebhookEvents(env);
  await env.DB.prepare(
    `UPDATE webhook_events SET processed_at = ?, status = ? WHERE id = ?`
  )
    .bind(Date.now(), status, id)
    .run();
}
