// src/services/runpod.service.ts

export async function submitToRunPod(
  input: {
    prompt: string;
    image_url: string;
    ratio?: string;
    model?: string;
  },
  env: any
) {
  const endpointId = env.RUNPOD_ENDPOINT_ID;
  const apiKey = env.RUNPOD_API_KEY;

  if (!endpointId || !apiKey) {
    throw new Error("Missing RUNPOD config");
  }

  const payload = {
    input: {
      prompt: input.prompt,
      image: input.image_url,
      ratio: input.ratio || "1:1",
      model: input.model || "qwen-image",
    },
  };

  const res = await fetch(
    `https://api.runpod.ai/v2/${endpointId}/run`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RunPod error ${res.status}: ${text}`);
  }

  return await res.json();
}
