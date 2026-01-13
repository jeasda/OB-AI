// src/services/runpod.ts
import type { Env } from "../index";

function runpodBase(env: Env) {
  // default ตาม runpod serverless
  return env.RUNPOD_API_BASE?.trim() || "https://api.runpod.ai/v2";
}

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _non_json: true, text };
  }
}

export async function runpodSubmitJob(
  env: Env,
  input: { prompt: string; model: string; jobId: string }
): Promise<{ id: string; status: string }> {
  const url = `${runpodBase(env)}/${env.RUNPOD_ENDPOINT_ID}/run`;

  const payload = {
    input: {
      prompt: input.prompt,
      model: input.model,
      job_id: input.jobId, // ส่งไว้เผื่อฝั่ง runpod handler/log
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RUNPOD_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data: any = await safeJson(res);

  if (!res.ok) {
    const msg = data?.error || data?.message || JSON.stringify(data);
    throw new Error(`runpod submit failed: ${res.status} ${msg}`);
  }

  // runpod ปกติจะคืน { id, status }
  const id = data?.id;
  const status = data?.status || "IN_QUEUE";
  if (!id) throw new Error(`runpod submit: missing id: ${JSON.stringify(data)}`);

  return { id, status };
}

export async function runpodGetStatus(env: Env, runpodJobId: string): Promise<any> {
  const url = `${runpodBase(env)}/${env.RUNPOD_ENDPOINT_ID}/status/${runpodJobId}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { authorization: `Bearer ${env.RUNPOD_API_KEY}` },
  });

  const data: any = await safeJson(res);

  if (!res.ok) {
    const msg = data?.error || data?.message || JSON.stringify(data);
    throw new Error(`runpod status failed: ${res.status} ${msg}`);
  }

  return data;
}
