export async function submitToRunPod(
  env: Env,
  payload: {
    prompt: string;
    image_url: string;
  }
) {
  const url = `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/run`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        prompt: payload.prompt,
        image: payload.image_url,
      },
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`RunPod submit failed (${res.status}): ${text}`);
  }

  return JSON.parse(text);
}

export async function getRunPodStatus(
  env: Env,
  runpodJobId: string
) {
  const url = `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/status/${runpodJobId}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
    },
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`RunPod status failed (${res.status}): ${text}`);
  }

  return JSON.parse(text);
}

export function extractOutputImageUrl(runpodResult: any): string | null {
  try {
    return (
      runpodResult?.output?.image_url ||
      runpodResult?.output?.images?.[0] ||
      null
    );
  } catch {
    return null;
  }
}
