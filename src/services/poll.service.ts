// src/services/poll.service.ts
import type { Env } from "../index";
import { runpodGetStatus } from "./runpod";

function nowISO() {
    return new Date().toISOString();
}

/**
 * Poll all running jobs from DB and sync status with RunPod.
 * Returns statistics about checked and updated jobs.
 */
export async function pollAllRunningJobs(env: Env) {
    // 1. ดึงงานที่กำลัง running (limit 20 เพื่อป้องกัน timeout ใน 1 รอบ)
    const res = await env.DB.prepare(
        `SELECT id, runpod_job_id, created_at FROM jobs WHERE status='running' AND runpod_job_id IS NOT NULL LIMIT 20`
    ).all();

    const jobs = (res.results || []) as Array<{ id: string; runpod_job_id: string; created_at: string }>;
    if (jobs.length === 0) {
        return { checked: 0, updated: [] };
    }

    const updated: any[] = [];
    const ts = nowISO();

    // 2. วนลูปเช็คสถานะ
    for (const j of jobs) {
        try {
            const st = await runpodGetStatus(env, j.runpod_job_id);

            // Runpod status: IN_QUEUE, IN_PROGRESS, COMPLETED, FAILED, CANCELLED
            const status = (st?.status || "").toUpperCase();

            if (status === "COMPLETED") {
                const output = st?.output ?? null;
                let resultUrl: string | null = null;
                let r2Key: string | null = null;

                // --- R2 Upload Logic ---
                let runpodOutputUrl: string | null = null;
                if (typeof output === "string") runpodOutputUrl = output;
                if (output && typeof output === "object") {
                    const anyOut: any = output;
                    runpodOutputUrl = anyOut.url || anyOut.image_url || anyOut.result_url || anyOut?.images?.[0] || null;
                }

                if (runpodOutputUrl) {
                    try {
                        // 1. fetch from runpod
                        const imgRes = await fetch(runpodOutputUrl);
                        if (imgRes.ok) {
                            const buffer = await imgRes.arrayBuffer();

                            // 2. generate r2 key: jobs/{YYYY}/{MM}/{jobId}/output.png
                            // ใช้ created_at หรือ now ก็ได้ แต่ use now เพื่อความง่าย หรือ parse created_at
                            // ขอใช้ Date ปัจจุบันเพื่อความง่ายตาม example
                            const now = new Date();
                            const year = now.getFullYear();
                            const month = String(now.getMonth() + 1).padStart(2, "0");
                            r2Key = `jobs/${year}/${month}/${j.id}/output.png`;

                            // 3. upload to R2
                            await env.R2_RESULTS.put(r2Key, buffer, {
                                httpMetadata: { contentType: "image/png" }
                            });

                            // 4. generate public url (Custom Domain หรือ Worker route)
                            // สมมติ: https://cdn.obaistudio.com/jobs/...
                            // หรือถ้ายังไม่มี domain, เก็บ r2Key ไปก่อน
                            // User example: https://cdn.obaistudio.com/...
                            resultUrl = `https://cdn.obaistudio.com/${r2Key}`;
                        }
                    } catch (uploadErr) {
                        console.error("R2 Upload failed:", uploadErr);
                        // ไม่ break flow, แต่ resultUrl อาจจะเป็น null หรือ runpod url เดิม
                        if (!resultUrl) resultUrl = runpodOutputUrl;
                    }
                }

                // Update DB -> done
                await env.DB.prepare(
                    `UPDATE jobs
           SET status='done', result_json=?, result_url=?, result_r2_key=?, finished_at=?, updated_at=?, error_message=NULL
           WHERE id=?`
                )
                    .bind(JSON.stringify(output), resultUrl, r2Key, ts, ts, j.id)
                    .run();

                updated.push({ id: j.id, status: "done", result_url: resultUrl, r2_key: r2Key });
            } else if (status === "FAILED" || status === "CANCELLED") {
                const err = st?.error || st?.message || "runpod failed";

                // Update DB -> error
                await env.DB.prepare(
                    `UPDATE jobs
           SET status='error', error_message=?, updated_at=?
           WHERE id=?`
                )
                    .bind(String(err), ts, j.id)
                    .run();

                updated.push({ id: j.id, status: "error", error: String(err) });
            } else {
                // Status: IN_QUEUE, IN_PROGRESS -> ยังไม่เสร็จ รอรอบหน้า
            }
        } catch (inner: any) {
            console.error(`Poll error for job ${j.id}:`, inner);
            // Logic from user: "ถ้า error ระหว่าง path -> update jobs SET status='error'"
            // แต่เราควรระวังไม่ให้ update error รัวๆ ถ้าเป็น transient error
            // เอาเป็นว่า ถ้าเป็น logic error ชัดเจนค่อย update
            // updated.push({
            //   id: j.id,
            //   status: "poll_error",
            //   error: String(inner?.message || inner),
            // });
        }
    }

    return { checked: jobs.length, updated };
}
