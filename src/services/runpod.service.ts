// src/services/runpod.service.ts
export async function submitToRunPod(input: {
  prompt: string;
  image_url: string;
  ratio: string;
  model: string;
}, env: {
  RUNPOD_API_KEY: string;
  RUNPOD_ENDPOINT_ID: string;
}) {
  if (!env.RUNPOD_API_KEY) {
    throw new Error("Missing RUNPOD_API_KEY");
  }
  if (!env.RUNPOD_ENDPOINT_ID) {
    throw new Error("Missing RUNPOD_ENDPOINT_ID");
  }

  const endpoint = `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/run`;

  // *** RunPod v2 expects: { input: {...} } ***
  const payload = {
    input: {
      prompt: input.prompt,
      image_url: input.image_url,
      ratio: input.ratio,
      model: input.model,
    }
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RUNPOD_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`RunPod submit failed (${res.status}): ${text}`);
  }

  return JSON.parse(text);
}
