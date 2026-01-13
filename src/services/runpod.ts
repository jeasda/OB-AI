// src/services/runpod.ts
// Service layer สำหรับคุยกับ RunPod Serverless API โดยตรง
// ใช้กับ Cloudflare Workers / Wrangler ได้

type RunPodEnv = {
  RUNPOD_API_KEY: string;
  RUNPOD_ENDPOINT_ID: string;
};

/**
 * ส่งงานเข้า RunPod (Serverless)
 * จะได้ job id กลับมา
 */
export async function runpodSubmitJob(
  env: RunPodEnv,
  input: Record<string, any>
) {
  if (!env.RUNPOD_API_KEY || !env.RUNPOD_ENDPOINT_ID) {
    throw new Error("RUNPOD env missing");
  }

  const apiKey = env.RUNPOD_API_KEY.trim();
  console.log(`[RunPod] Key: ${apiKey.slice(0, 5)}... (Length: ${apiKey.length})`);
  console.log(`[RunPod] Endpoint: ${env.RUNPOD_ENDPOINT_ID}`);

  const url = `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/run`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "RunPod-Client/1.0",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      input, // สำคัญ: RunPod ต้องครอบ input
    }),
  });

  // LOG REQUEST BODY FOR DEBUGGING
  console.log("RunPod Request Body:", JSON.stringify({ input }));

  if (!res.ok) {
    const text = await res.text();
    console.error(`[RunPod Error] Status: ${res.status}, Body: ${text}`);
    throw new Error(`RunPod submit failed (${res.status}): ${text}`);
  }

  return res.json(); // { id, status }
}

/**
 * เช็คสถานะ job จาก RunPod
 * ใช้ใน /runpod-poll
 */
export async function runpodGetStatus(
  env: RunPodEnv,
  jobId: string
) {
  if (!env.RUNPOD_API_KEY || !env.RUNPOD_ENDPOINT_ID) {
    throw new Error("RUNPOD env missing");
  }

  const url = `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/status/${jobId}`;

  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${env.RUNPOD_API_KEY}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RunPod status failed (${res.status}): ${text}`);
  }

  return res.json();
}
