export async function readJSON<T>(req: Request): Promise<T> {
  try {
    return await req.json();
  } catch {
    throw new Error("Invalid JSON body");
  }
}
