import { pollRunpod } from "../worker/runpod/poll";

export async function onRequest(context: any) {
  const { request, env } = context;

  // กัน method มั่ว
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "POST only",
      }),
      { status: 405, headers: { "content-type": "application/json" } }
    );
  }

  // กัน env หาย (ตัวนี้แหละที่ทำให้ 1101)
  if (!env.DB) {
    return new Response(
      JSON.stringify({ ok: false, error: "DB binding missing" }),
      { status: 500 }
    );
  }

  if (!env.RUNPOD_API_KEY) {
    return new Response(
      JSON.stringify({ ok: false, error: "RUNPOD_API_KEY missing" }),
      { status: 500 }
    );
  }

  try {
    const result = await pollRunpod(env);
    return new Response(JSON.stringify(result), {
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message || "poll failed",
      }),
      { status: 500 }
    );
  }
}
