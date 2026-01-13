export async function submitToRunPod(
  env: Env,
  payload: {
    prompt: string;
    image_url: string;
  }
) {
  const res = await fetch(url, {
  method: "POST",
  headers,
  body: JSON.stringify(payload),
});

const text = await res.text();

if (!res.ok) {
  throw new Error(`RunPod error ${res.status}: ${text}`);
}

let data;
try {
  data = JSON.parse(text);
} catch {
  throw new Error("RunPod response is not JSON");
}

return data;

export async function getRunPodStatus(env: Env, jobId: string) {
  const res = await fetch(
    `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/status/${jobId}`,
    {
      headers: {
        Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
      },
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`RunPod status failed: ${res.status} ${t}`);
  }

  return res.json();
}

export function extractOutputImageUrl(status: any): string | null {
  return status?.output?.image_url ?? null;
}
