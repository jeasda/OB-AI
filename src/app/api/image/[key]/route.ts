import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: { key: string } }
) {
  const { key } = context.params;

  return new Response(
    JSON.stringify({ ok: true, key }),
    { headers: { "Content-Type": "application/json" } }
  );
}
