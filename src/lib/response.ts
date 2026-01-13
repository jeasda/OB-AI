export function ok(data: unknown) {
  return Response.json({ ok: true, ...data });
}

export function fail(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}
