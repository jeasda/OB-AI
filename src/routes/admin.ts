// src/routes/admin.ts
import type { Env } from "../index";

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
        },
    });
}

export async function handleAdminMigrate(request: Request, env: Env) {
    const report: string[] = [];
    try {
        // 1. Check R2 Binding
        if (env.R2_RESULTS) {
            report.push("✅ R2_RESULTS binding found.");
            try {
                await env.R2_RESULTS.list({ limit: 1 });
                report.push("✅ R2 bucket list successful.");
            } catch (e) {
                report.push(`⚠️ R2 bucket list failed: ${e}`);
            }
        } else {
            report.push("❌ R2_RESULTS binding MISSING.");
        }

        // 2. Check DB and Run Migrations
        // We try to add columns. If they exist, it might fail, so we wrap individually.

        // Ensure table exists
        try {
            await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          runpod_job_id TEXT,
          status TEXT,
          prompt TEXT,
          model TEXT,
          result_r2_key TEXT,
          result_url TEXT,
          finished_at TEXT,
          error_message TEXT,
          created_at TEXT,
          updated_at TEXT
        );
      `).run();
            report.push("✅ Table 'jobs' checked/created.");
        } catch (e) {
            report.push(`❌ Create Table jobs failed: ${e}`);
        }

        // Add model
        try {
            await env.DB.prepare("ALTER TABLE jobs ADD COLUMN model TEXT").run();
            report.push("✅ Column 'model' added.");
        } catch (e: any) {
            if (e.message?.includes("duplicate column")) {
                report.push("ℹ️ Column 'model' already exists.");
            } else {
                report.push(`⚠️ Add 'model' failed (might exist): ${e.message}`);
            }
        }

        // Add ratio
        try {
            await env.DB.prepare("ALTER TABLE jobs ADD COLUMN ratio TEXT").run();
            report.push("✅ Column 'ratio' added.");
        } catch (e: any) {
            if (e.message?.includes("duplicate column")) {
                report.push("ℹ️ Column 'ratio' already exists.");
            } else {
                report.push(`⚠️ Add 'ratio' failed (might exist): ${e.message}`);
            }
        }

        // Add image_url
        try {
            await env.DB.prepare("ALTER TABLE jobs ADD COLUMN image_url TEXT").run();
            report.push("✅ Column 'image_url' added.");
        } catch (e: any) {
            if (e.message?.includes("duplicate column")) {
                report.push("ℹ️ Column 'image_url' already exists.");
            } else {
                report.push(`⚠️ Add 'image_url' failed (might exist): ${e.message}`);
            }
        }

        return json({ ok: true, report });

    } catch (e: any) {
        return json({ ok: false, error: String(e), report }, 500);
    }
}
