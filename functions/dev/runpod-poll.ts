// C:\Anti_OB\runninghub-app\functions\dev\runpod-poll.ts

export interface Env {
  DB: D1Database;
  RUNPOD_API_KEY: string;
  RUNPOD_ENDPOINT_ID: string; // endpoint id ของ serverless
  RUNPOD_BASE_URL?: string;   // optional, default https://api.runpod.ai
}

type QueueRow = {
  id: string;
  prompt: string | null;
  model: string | null;
  status: string | null;
  runpod_job_id: string | null;
  created_at: string | null;
  updated_at?: string | null;
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  });
}

async function runpodGetStatus(env: Env, runpodJobId: string) {
  const base = env.RUNPOD_BASE_URL || "https://api.runpod.ai";
  const url = `${base}/v2/${env.RUNPOD_ENDPOINT_ID}/status/${runpodJobId}`;

  const r = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
    },
  });

  const text = await r.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return { ok: r.ok, status: r.status, data };
}

function pickResult(data: any): { result_url?: string; result_json?: string } {
  // Runpod response มักมีหลายรูปแบบ ตาม handler ของลูกพี่
  // เราจะ “เก็บทั้งก้อน” เป็น result_json และพยายามเดา url ถ้ามี
  let result_url: string | undefined;

  const output = data?.output ?? data?.result ?? null;

  // ถ้า output เป็น string แล้วดูเหมือน url
  if (typeof output === "string" && /^https?:\/\//.test(output)) {
    result_url = output;
  }

  // ถ้า output เป็น object/array แล้วมี url อยู่ข้างใน
  if (!result_url && output && typeof output === "object") {
    const candidates = [
      output.url,
      output.image_url,
      output.images?.[0],
      output.images?.[0]?.url,
      output[0],
      output[0]?.url,
    ].filter(Boolean);

    const first = candidates[0];
    if (typeof first === "string" && /^https?:\/\//.test(first)) result_url = first;
  }

  return {
    result_url,
    result_json: JSON.stringify(data ?? {}),
  };
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  // กัน error JSON ว่าง
  const body = await request.json().catch(() => ({} as any));

  // optional: จำกัดจำนวนงานต่อครั้ง
  const limit = Math.min(Number(body?.limit ?? 10), 25);

  // ดึงงานที่กำลัง running และมี runpod_job_id
  const rows = await env.DB.prepare(
    `SELECT id, prompt, model, status, runpod_job_id, created_at
     FROM queue
     WHERE status = 'running' AND runpod_job_id IS NOT NULL
     ORDER BY created_at ASC
     LIMIT ?`
  )
    .bind(limit)
    .all<QueueRow>();

  const updated: any[] = [];
  let checked = 0;

  for (const job of rows.results ?? []) {
    checked++;

    const runpodJobId = job.runpod_job_id!;
    const resp = await runpodGetStatus(env, runpodJobId);

    if (!resp.ok) {
      // ถ้าเรียก runpod ไม่ได้ -> ไม่อัพเดต status ทิ้ง (กัน false alarm)
      updated.push({
        id: job.id,
        runpod_job_id: runpodJobId,
        note: "runpod status fetch failed",
        http_status: resp.status,
      });
      continue;
    }

    const data = resp.data;
    const status = (data?.status || "").toString().toUpperCase();

    // status ตัวอย่างที่เจอบ่อย: IN_QUEUE, IN_PROGRESS, COMPLETED, FAILED, CANCELED
    if (status === "COMPLETED") {
      const picked = pickResult(data);

      await env.DB.prepare(
        `UPDATE queue
         SET status='done',
             result_url=?,
             result_json=?,
             error=NULL,
             updated_at=?
         WHERE id=?`
      )
        .bind(
          picked.result_url ?? null,
          picked.result_json ?? null,
          new Date().toISOString(),
          job.id
        )
        .run();

      updated.push({ id: job.id, runpod_job_id: runpodJobId, status: "done", result_url: picked.result_url ?? null });
    } else if (status === "FAILED" || status === "CANCELED") {
      await env.DB.prepare(
        `UPDATE queue
         SET status='error',
             error=?,
             updated_at=?
         WHERE id=?`
      )
        .bind(JSON.stringify(data ?? {}), new Date().toISOString(), job.id)
        .run();

      updated.push({ id: job.id, runpod_job_id: runpodJobId, status: "error" });
    } else {
      // IN_QUEUE / IN_PROGRESS -> ยังไม่ done
      updated.push({ id: job.id, runpod_job_id: runpodJobId, status: job.status, runpod_status: status });
    }
  }

  return json({ ok: true, checked, updated });
}
