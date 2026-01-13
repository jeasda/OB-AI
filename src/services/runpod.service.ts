export async function submitToRunpod(
  env: any,
  payload: {
    prompt: string;
    image: string;
    ratio: string;
    jobId: string;
  }
) {
  const endpoint = `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/run`;

  const body = {
    input: {
      prompt: payload.prompt,
      image: payload.image, // ✅ ใช้แค่นี้
      ratio: payload.ratio,
    },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`RunPod submit failed (${res.status}): ${t}`);
  }

  return await res.json();
}
