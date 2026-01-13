// src/services/runpod.service.ts
import type { Env } from "../index";

export type RunpodRunResponse = {
  id?: string;
  status?: string; // IN_QUEUE / IN_PROGRESS / COMPLETED / FAILED (แล้วแต่ endpoint)
  [k: string]: any;
};

export async function submitToRunpod(params: { prompt: string; imageUrl: string }, env: Env) {
  const { prompt, imageUrl } = params;

  if (!env.RUNPOD_API_KEY) throw new Error("Missing RUNPOD_API_KEY");
  if (!env.RUNPOD_ENDPOINT_ID) throw new Error("Missing RUNPOD_ENDPOINT_ID");

  const endpointId = env.RUNPOD_ENDPOINT_ID.trim();
  const url = `https://api.runpod.ai/v2/${endpointId}/run`;

  // ✅ IMPORTANT: Payload ที่ถูกต้องสำหรับ Qwen Image Edit
  const payload = {
    input: {
      prompt,
      image: imageUrl,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data: RunpodRunResponse | any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    // เอา body โชว์ชัด ๆ จะได้ debug ได้ทันที
    throw new Error(`RunPod submit failed (${res.status}): ${JSON.stringify(data)}`);
  }

  return data as RunpodRunResponse;
}
