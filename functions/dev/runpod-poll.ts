import type { PagesFunction } from "@cloudflare/workers-types";
console.log("🔥 RUNPOD POLL WORKER v2026-01-10 LOADED");


/**
 * POST /dev/runpod-poll
 *
 * - ไม่รับ body
 * - ไม่อ่าน request.json()
 * - ใช้สำหรับ poll สถานะ job จาก RunPod
 */
export const onRequestPost: PagesFunction = async ({ env }) => {
  try {
    // 1) ดึง job ที่กำลัง running และมี runpod_job_id
    const { results } = await env.DB
      .prepare(`
        SELECT id, runpod_job_id
        FROM queue
        WHERE status = 'running'
          AND runpod_job_id IS NOT NULL
      `)
      .all();

    let updated: any[] = [];

    // 2) loop ไปเช็คสถานะจาก RunPod
    for (const job of results) {
      const runpodJobId = job.runpod_job_id;

      // เรียก RunPod API
      const res = await fetch(
        `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/status/${runpodJobId}`,
        {
          headers: {
            Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
          },
        }
      );

      const data = await res.json();

      // 3) ถ้า job เสร็จ
      if (data.status === "COMPLETED") {
        await env.DB
          .prepare(`
            UPDATE queue
            SET status = 'done'
            WHERE id = ?
          `)
          .bind(job.id)
          .run();

        updated.push({
          id: job.id,
          status: "done",
        });
      }

      // 4) ถ้า job พัง
      if (data.status === "FAILED") {
        await env.DB
          .prepare(`
            UPDATE queue
            SET status = 'error'
            WHERE id = ?
          `)
          .bind(job.id)
          .run();

        updated.push({
          id: job.id,
          status: "error",
        });
      }
    }

    // 5) response
    return new Response(
      JSON.stringify({
        ok: true,
        checked: results.length,
        updated,
      }),
      {
        headers: {
          "content-type": "application/json",
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message || String(err),
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json",
        },
      }
    );
  }
};
