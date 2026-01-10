export async function onRequestPost({ request, env }: any) {
  try {
    const body = await request.json();

    return new Response(
      JSON.stringify({
        ok: true,
        received: body,
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message ?? "unknown error",
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json",
        },
      }
    );
  }
}
