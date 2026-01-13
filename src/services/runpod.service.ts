export async function submitToRunPod(
  env: Env,
  payload: {
    prompt: string;
    image_url: string;
  }
) {
  const res = await fetch(
    `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/run`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({
        input: {
          prompt: payload.prompt,
          image_url: payload.image_url,
        },
      }),
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`RunPod submit failed: ${res.status} ${t}`);
  }

  return res.json();
}

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
