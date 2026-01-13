export async function submitToRunPod(env: Env, payload: {
  prompt: string;
  image_url: string;
}) {
  const endpointId = env.RUNPOD_ENDPOINT_ID;
  const apiKey = env.RUNPOD_API_KEY;

  const url = `https://api.runpod.ai/v2/${endpointId}/run`;

  const body = {
    input: {
      prompt: payload.prompt,
      image: payload.image_url
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`RunPod submit failed (${res.status}): ${text}`);
  }

  return JSON.parse(text);
}
