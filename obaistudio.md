# OB AI Studio – System Status & Architecture (Update 13 Jan 2026)

เอกสารนี้คือบันทึกสถานะปัจจุบันของระบบ OB AI Studio ใช้เป็น reference สำหรับการพัฒนา, debug, onboarding และ AI-assisted development

## 1. ภาพรวมระบบ (Current Phase)
**Phase:** Backend-first / Infra & Pipeline Stabilization
**เป้าหมายหลักตอนนี้:**
- ทำให้ระบบ Queue → RunPod → Poll → R2 → Done ทำงานจริงและนิ่ง
- แยก Backend ออกจาก UI อย่างชัดเจน
- รองรับ AI Image / AI Job แบบ async โดยใช้ R2 เก็บผลลัพธ์ถาวร

## 2. Tech Stack (Current)
**Core Stack**
- **Runtime:** Bun (local dev)
- **API Framework:** Elysia-style handlers
- **API Host:** Cloudflare Wrangler
- **Database:** Cloudflare D1 (Table: `jobs`)
- **Object Storage:** Cloudflare R2 (Bucket: `ob-ai-results`)
- **AI Compute:** RunPod (Serverless Endpoint)

## 3. Repository Structure
```
runninghub-app/
├─ src/
│  ├─ index.ts                # Main Router & Scheduled Handler (Loop Polling)
│  ├─ routes/
│  │  ├─ queue.ts             # POST /api/queue/create (Insert -> jobs)
│  │  ├─ runpod.ts            # POST /dev/runpod (Submit -> RunPod)
│  │  └─ runpod-poll.ts       # POST /dev/runpod-poll (Manual Poll)
│  ├─ services/
│  │  ├─ runpod.ts            # RunPod API Client
│  │  └─ poll.service.ts      # Core Logic: Poll -> Fetch -> R2 Upload -> DB Update
│  └─ lib/
│     └─ helpers.ts           # Utils
│
├─ schema.sql                 # D1 Schema (jobs table)
├─ wrangler.toml              # Config (D1, R2, Cron)
└─ .env.local                 # ENV Secrets
```

## 4. Environment Variables
ไฟล์: `.env.local`
```bash
RUNPOD_API_KEY=rpa_************************* (Masked for Security)
RUNPOD_ENDPOINT_ID=i3qcf6gz8v495h
```

## 5. Database (D1)
**Binding:** `DB`
**Table:** `jobs` (Updated Schema)

```sql
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  runpod_job_id TEXT,
  status TEXT,        -- queued, running, done, error
  prompt TEXT,
  model TEXT,
  result_r2_key TEXT, -- Path in R2 (e.g., jobs/2026/01/123/output.png)
  result_url TEXT,    -- Public URL (e.g., https://cdn.../output.png)
  finished_at TEXT,   -- Timestamp when done
  error_message TEXT, -- Runpad/Upload failure reason
  created_at TEXT,
  updated_at TEXT
);
```

## 6. R2 Storage (New!) 🪣
- **Binding:** `R2_RESULTS`
- **Bucket Name:** `ob-ai-results`
- **Path structure:** `jobs/{YYYY}/{MM}/{job_id}/output.png`
- **Integration:** Handled in `poll.service.ts` automatically upon job completion.

## 7. Auto Poll System (Cron + Loop) 🕒
**Architecture:**
- **Trigger:** Cron `*/1 * * * *` (Every 1 minute)
- **Handler:** `src/index.ts` executes a loop.
- **Loop Logic:** Runs 4 rounds, waiting 15 seconds between rounds.
- **Action:** Calls `pollAllRunningJobs` to sync status and upload files.

## 8. Current End-to-End Flow
1.  **Client:** `POST /api/queue/create` → Save to `jobs` (queued).
2.  **Dev/Cron:** `POST /dev/runpod` → Submit to RunPod → Update `jobs` (running).
3.  **Cron Worker:** Wakes up every minute, loops every 15s.
    - Checks RunPod Status.
    - If `COMPLETED`:
        - Fetches image from RunPod.
        - Uploads to **R2** (`R2_RESULTS`).
        - Updates **D1** (`status='done'`, `result_url`, `result_r2_key`).

## 9. สิ่งที่ทำสำเร็จแล้ว ✅
- **Infrastructure:** D1, R2, Cron, Worker Environment setup.
- **Backend Logic:** Full async pipeline (Queue -> RunPod -> R2).
- **Refactor:** Standardized on `jobs` table.
- **Automation:** Auto-polling with loop strategy working.

## 10. Next Steps
- **Frontend:** Build a simple UI to list jobs and show images from `result_url`.
- **Optimization:** Add retry policies or dead-letter queue for failed uploads.
