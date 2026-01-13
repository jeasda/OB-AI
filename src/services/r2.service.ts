import type { Env } from "../env";

export async function putToR2(
  env: Env,
  key: string,
  body: ArrayBuffer,
  contentType: string
): Promise<string> {
  await env.R2_RESULTS.put(key, body, {
    httpMetadata: { contentType },
  });

  // หมายเหตุ: URL public ของ R2 ต้องผูก custom domain / public bucket เอง
  // ในระบบลูกพี่ตอนนี้ใช้ "cdn.obaistudio.com" เป็น public uploader อยู่แล้ว
  // ดังนั้นฟังก์ชันนี้คืนค่าเป็น r2://key ไว้ก่อนเพื่อ debug
  return `r2://${key}`;
}
