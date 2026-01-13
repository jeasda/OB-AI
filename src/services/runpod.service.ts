import { Env } from "../env";

const RUNPOD_BASE = "https://api.runpod.ai/v2";

export async function submitToRunPod(
  env: Env,
  payload: {
    prompt: string;
    image_url: string;
    ratio: string;
    model: string;
  }
) {
  const res = await fetch(
    `${RUNPOD_BASE}/${env.RUNPOD_ENDPOINT_ID}/run`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({
        input: payload,
      }),
    }
  );

  const json = await res.json<any>();
  if (!res.ok) {
    throw new Error(JSON.stringify(json));
  }

  return json.id as string;
}

export async function getRunPodStatus(env: Env, jobId: string) {
  const res = await fetch(
    `${RUNPOD_BASE}/${env.RUNPOD_ENDPOINT_ID}/status/${jobId}`,
    {
      headers: {
        Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
      },
    }
  );

  const json = await res.json<any>();
  if (!res.ok) {
    throw new Error(JSON.stringify(json));
  }

  return json;
}

export function extractOutputImageUrl(result: any): string | null {
  return (
    result?.output?.images?.[0] ??
    result?.output?.image ??
    null
  );
}
