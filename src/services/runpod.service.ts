// src/services/runpod.service.ts

import { Env } from "../env";

const RUNPOD_BASE = "https://api.runpod.ai/v2";

/**
 * Submit job to RunPod
 */
export async function submitToRunPod(
  env: Env,
  payload: Record<string, any>
) {
  const url = `${RUNPOD_BASE}/${env.RUNPOD_ENDPOINT_ID}/run`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RUNPOD_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`RunPod submit error ${res.status}: ${text}`);
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("RunPod submit response is not JSON");
  }

  return data;
}

/**
 * Get job status from RunPod
 */
export async function getRunPodStatus(env: Env, jobId: string) {
  const url = `${RUNPOD_BASE}/${env.RUNPOD_ENDPOINT_ID}/status/${jobId}`;

  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${env.RUNPOD_API_KEY}`,
    },
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`RunPod status error ${res.status}: ${text}`);
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("RunPod status response is not JSON");
  }

  return data;
}

/**
 * Extract output image URL from RunPod result
 */
export function extractOutputImageUrl(result: any): string | null {
  if (!result) return null;

  // รองรับหลายรูปแบบ เผื่อ model เปลี่ยน
  return (
    result?.output?.image_url ||
    result?.output?.images?.[0] ||
    null
  );
}
