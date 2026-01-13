# OB AI Studio – System Status & Architecture (Update 13 Jan 2026)

เอกสารนี้คือบันทึกสถานะปัจจุบันของระบบ OB AI Studio ใช้เป็น reference สำหรับการพัฒนา, debug, onboarding และ AI-assisted development

## 1. ภาพรวมระบบ (Current Phase)
**Phase:** Backend-first / Infra & Pipeline Stabilization + **Frontend V1**
**เป้าหมายหลักตอนนี้:**
- ทำให้ระบบ Queue → RunPod → Poll → R2 → Done ทำงานจริงและนิ่ง
- **[DONE]** Frontend V1: UI สำหรับ Generate Image (deploy บน Cloudflare Pages)
- **[DONE]** Backend: รองรับ CORS และ Public API

## 2. Tech Stack (Current)
**Core Stack**
- **Runtime:** Bun (local dev)
- **API Framework:** Elysia-style handlers
- **API Host:** Cloudflare Workers (`ob-ai-api`)
- **Frontend Host:** Cloudflare Pages (`ob-ai`)
- **Database:** Cloudflare D1 (Table: `jobs`)
- **Object Storage:** Cloudflare R2 (Bucket: `ob-ai-results`)
- **AI Compute:** RunPod (Serverless Endpoint)

## 3. Repository Structure
```
runninghub-app/
├─ frontend/                  # [NEW] Cloudflare Pages Root
│  ├─ index.html              # UI Structure
│  ├─ style.css               # Premium Dark Mode CSS
│  └─ app.js                  # Frontend Logic (API Calls, Polling)
│
├─ src/
│  ├─ index.ts                # Main Router (CORS Enabled) & Cron Handler
│  ├─ routes/
│  │  ├─ queue.ts             # POST /api/queue/create, GET /api/queue/status
│  │  ├─ runpod.ts            # POST /dev/runpod (Internal submit)
│  │  └─ runpod-poll.ts       # POST /api/runpod-poll (Manual trigger)
│  ├─ services/
│  │  ├─ runpod.ts            # RunPod API Client
│  │  └─ poll.service.ts      # Core Logic: Poll -> Fetch -> R2 Upload -> DB Update
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
  ratio TEXT,         -- [NEW] e.g. "1:1", "16:9"
  image_url TEXT,     -- [NEW] Input image (optional)
  result_r2_key TEXT, -- Path in R2
  result_url TEXT,    -- Public URL
  finished_at TEXT,
  error_message TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

## 6. R2 Storage 🪣
- **Binding:** `R2_RESULTS`
- **Bucket:** `ob-ai-results`
- **Path structure:** `jobs/{YYYY}/{MM}/{job_id}/output.png`
- **Integration:** Handled in `poll.service.ts`

## 7. Frontend V1 (Cloudflare Pages) 🖥️
**Features:**
- **Premium UI:** Dark mode, glassmorphism, animations.
- **Progress Illusion:** Fake progress bar (0-95%) while waiting.
- **Auto Polling:** Checks status every 5 seconds.
- **Architecture:** Static HTML/JS calling Worker API via CORS.

**Endpoints Used:**
- `POST /api/queue/create`: Send prompt & ratio.
- `GET /api/queue/status?id=...`: Check job status.
- `POST /api/runpod-poll`: Trigger manual poll (optional optimization).

## 8. Current End-to-End Flow
1.  **Frontend:** User calls `POST /api/queue/create` → **D1** (queued).
2.  **Worker (Dev/Cron):** `POST /dev/runpod` → Submit to RunPod → **D1** (running).
3.  **Cron Worker:** Wakes up every minute, loops every 15s to check RunPod.
    - If `COMPLETED`: Fetch -> Upload R2 -> Update **D1** (done).
4.  **Frontend:** Polls `GET /api/queue/status`.
    - Sees `done` → Shows Image from `result_url`.

## 9. สิ่งที่ทำสำเร็จแล้ว ✅
- **Infrastructure:** D1, R2, Cron, Worker.
- **Backend Logic:** Async pipeline (Queue -> RunPod -> R2).
- **Frontend V1:** Complete (UI, Polling, Result Display).
- **Deployment Ready:** Frontend (Pages) + Backend (Workers).

## 10. Next Steps
- **Production Deploy:** Deploy Workers (`wrangler deploy`) and Pages.
- **Domain Setup:** Connect custom domains (e.g., api.ob-ai.com).
