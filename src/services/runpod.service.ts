export async function submitToRunPod(
  env: Env,
  payload: {
    prompt: string;
    ratio?: string;
    model?: string;
    image: File;
  }
): Promise<string> {
  const body = {
    input: {
      prompt: payload.prompt,
      ratio: payload.ratio ?? "9:16",
      model: payload.model ?? "qwen-image",
    },
  };

  const res = await fetch(
    `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/run`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`RunPod submit failed: ${t}`);
  }

  const json: any = await res.json();
  return json.id;
}
