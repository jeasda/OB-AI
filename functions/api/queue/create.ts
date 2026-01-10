export const onRequestPost = async (context: any) => {
  try {
    const { request, env } = context;

    const body = await request.json();

    // ตัวอย่าง response ชั่วคราว (ไว้เช็ค deploy)
    return new Response(
      JSON.stringify({
        status: "ok",
        message: "queue created",
        body,
      }, null, 2),
      {
        headers: {
          "content-type": "application/json",
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: err?.message ?? "unknown error",
      }, null, 2),
      { status: 500 }
    );
  }
};
