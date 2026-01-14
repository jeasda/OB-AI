# OB AI Studio – Project Specification & System Architecture
**Last Updated:** 15 Jan 2026

---

## 🎯 วัตถุประสงค์และความมุ่งหมาย (Vision & Mission)

### Vision Statement
**"สร้างแพลตฟอร์ม AI Image Editing ที่ใช้งานง่าย ไม่ต้องมีความรู้ด้าน AI หรือ Machine Learning ก็สามารถแก้ไขรูปภาพด้วย AI ได้ทันที"**

### Mission
- ทำให้ผู้ใช้ทั่วไปเข้าถึงเทคโนโลยี AI Image Generation/Editing ได้ง่าย
- ลดความซับซ้อนของ ComfyUI Workflow ให้เหลือแค่ "Upload + Prompt + Generate"
- สร้างระบบที่ Scale ได้ รองรับผู้ใช้หลายคนพร้อมกัน (Multi-tenant)
- เป้าหมายสุดท้าย: **เป็นบริการแบบ Runninghub** ที่ผู้ใช้สามารถ Subscribe และใช้งานได้ทันที

---

## 📋 Project Objectives (เป้าหมายโครงการ)

| เป้าหมาย | รายละเอียด | สถานะ |
|----------|------------|-------|
| **1. Core Platform** | ระบบพื้นฐานที่รองรับ Image Upload, Queue, และ Processing | ✅ Done |
| **2. AI Integration** | เชื่อมต่อกับ ComfyUI ผ่าน RunPod Serverless | 🔄 In Progress |
| **3. User Experience** | UI/UX ที่ใช้งานง่าย, Progress Feedback, Error Handling | ✅ Done |
| **4. Scalability** | รองรับ Multi-user, Queue Management, Rate Limiting | 📋 Planned |
| **5. Monetization** | Subscription Model, Credit System, Payment Integration | 📋 Planned |

---

## 🛤️ Roadmap: จากเริ่มต้นสู่บริการ (Development to Production Service)

### Phase 1: Foundation (✅ Completed)
> **เป้าหมาย:** สร้างโครงสร้างพื้นฐานที่แข็งแรง

- [x] Setup Cloudflare Workers (API Backend)
- [x] Setup Cloudflare D1 (Database)
- [x] Setup Cloudflare R2 (Object Storage)
- [x] Basic Job Queue System (Create, Status, Poll)
- [x] CORS & Security Headers

### Phase 2: AI Pipeline (🔄 Current)
> **เป้าหมาย:** เชื่อมต่อ AI และทำให้ทำงานได้จริง

- [x] RunPod Serverless Integration
- [x] Auto-Submit on Upload
- [x] Background Polling (Cron)
- [x] Result Storage to R2
- [ ] **Debug 400 Bad Request** ← กำลังทำ
- [ ] Workflow Template Injection

### Phase 3: Product Polish (📋 Next)
> **เป้าหมาย:** ปรับปรุง UX ให้พร้อมใช้งานจริง

- [ ] Better Error Messages (Thai)
- [ ] Job History View
- [ ] Image Comparison (Before/After Slider)
- [ ] Download Options (Original, Edited)
- [ ] Mobile Optimization

### Phase 4: Multi-User & Auth (📋 Planned)
> **เป้าหมาย:** รองรับผู้ใช้หลายคน

- [ ] User Authentication (Cloudflare Access / OAuth)
- [ ] User Dashboard (My Jobs, History)
- [ ] Rate Limiting per User
- [ ] Job Isolation (Users can only see their own jobs)

### Phase 5: Monetization (📋 Future)
> **เป้าหมาย:** เปลี่ยนเป็นบริการที่สร้างรายได้

- [ ] Credit System (1 Generation = X Credits)
- [ ] Subscription Tiers (Free, Pro, Enterprise)
- [ ] Payment Integration (Stripe / PromptPay)
- [ ] Usage Analytics & Billing Dashboard
- [ ] API Access for Developers (Pay-per-use)

### Phase 6: Production Launch 🚀
> **เป้าหมาย:** เปิดให้บริการจริงแบบ Runninghub

- [ ] Custom Domain (app.obaistudio.com)
- [ ] SSL & CDN Optimization
- [ ] Monitoring & Alerting
- [ ] Customer Support System
- [ ] Marketing & Onboarding Flow

---

## 🔄 Service Flow: End-to-End User Journey

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  User       │────▶│  Frontend    │────▶│  Backend    │
│  (Browser)  │     │  (Pages)     │     │  (Workers)  │
└─────────────┘     └──────────────┘     └──────────────┘
                                                │
                    ┌───────────────────────────┴───────────────────────────┐
                    │                                                       │
                    ▼                                                       ▼
            ┌──────────────┐                                    ┌──────────────┐
            │  Cloudflare  │                                    │   RunPod     │
            │  R2 (Images) │◀───────────────────────────────────│  Serverless  │
            └──────────────┘                                    │  (ComfyUI)   │
                    ▲                                           └──────────────┘
                    │
            ┌──────────────┐
            │  Cloudflare  │
            │  D1 (Queue)  │
            └──────────────┘
```

**User Story:**
1. ผู้ใช้เข้าเว็บ → Upload รูป → พิมพ์คำสั่ง → กด Generate
2. ระบบ Upload รูปไป R2 → บันทึก Job ใน D1 → ส่งไป RunPod
3. RunPod ประมวลผลด้วย ComfyUI → ส่งผลลัพธ์กลับมา
4. ระบบดึงผลลัพธ์ → เก็บใน R2 → แจ้ง User ว่าเสร็จแล้ว
5. ผู้ใช้ดูผลลัพธ์และ Download ได้

---

## 📊 Success Metrics (KPIs)

| Metric | Target | Current |
|--------|--------|---------|
| Job Success Rate | > 95% | Pending |
| Average Processing Time | < 60s | Not Measured |
| Concurrent Users | 100+ | Not Tested |
| User Retention (30 days) | > 40% | N/A |
| Monthly Revenue | Target TBD | N/A |

---

## 1. ภาพรวมระบบ (Current Phase)
**Phase:** **Frontend V2 (Qwen Image Edit)** / Automated Pipeline Stabilization
**สถานะปัจจุบัน:**
- **[DONE]** Frontend V2: UI ใหม่ รองรับ Image Upload, Drag & Drop, Prompt, Ratio และ Progress Animation
- **[DONE]** Backend: Auto-Submit Job ไปยัง RunPod ทันทีที่ Upload รูป
- **[DONE]** Database: Schema รองรับ `image_url` และ `ratio`
- **[IN PROGRESS]** RunPod Integration: กำลังแก้ปัญหา 400 Bad Request (Payload Tuning)

## 2. Tech Stack (Current)
**Core Stack**
- **Runtime:** Clouflare Workers (Platform) / Bun (Local)
- **Framework:** Hono-like Handlers (Native Fetch)
- **API Host:** Cloudflare Workers (`ob-ai-api`)
- **Frontend Host:** Cloudflare Pages (`ob-ai`)
- **Database:** Cloudflare D1 (Table: `jobs`)
- **Object Storage:** Cloudflare R2 (Bucket: `ob-ai-results`)
- **AI Compute:** RunPod Serverless (ComfyUI Endpoint)

## 3. Repository Structure
```
runninghub-app/
├─ frontend/                  # Cloudflare Pages Root (Frontend V2)
│  ├─ index.html              # Split Layout (Left: Control, Right: Preview)
│  ├─ style.css               # Premium Dark Mode, Animations, Glassmorphism
│  ├─ app.js                  # Logic: Upload -> Auto Poll -> Status Update
│  └─ assets/                 # Icons (logo.png, etc.)
│
├─ src/
│  ├─ index.ts                # Main Router (CORS, Global Error Handling, Cron)
│  ├─ routes/
│  │  ├─ queue.ts             # POST /api/queue/create (Multipart w/ Auto-Submit), GET /api/queue/status
│  │  ├─ admin.ts             # GET /dev/migrate (Self-Healing DB Schema)
│  │  ├─ health.ts            # GET /health (Basic check)
│  │  ├─ runpod.ts            # POST /dev/runpod (Manual Debug trigger)
│  │  └─ runpod-poll.ts       # POST /api/runpod-poll (Manual Poll trigger)
│  ├─ services/
│  │  ├─ runpod.ts            # RunPod API Client (Submit & Status)
│  │  └─ poll.service.ts      # Core Logic: Poll -> Fetch -> R2 Upload -> DB Update
│  └─ lib/
│     └─ workflow.ts          # (Optional) ComfyUI Workflow Template
│
├─ scripts/                   # Debugging & Utility Scripts
│  ├─ test_runpod_direct.js   # Node.js script to test RunPod API directly
│  └─ ...
│
├─ schema.sql                 # D1 Schema (jobs table)
├─ wrangler.toml              # Config (D1, R2, Cron, Env Vars)
└─ .env.local                 # ENV Secrets (RunPod Key)
```

## 4. Environment Variables
ไฟล์: `.env.local` (Local) / Wrangler Secrets (Production)
```bash
RUNPOD_API_KEY=rpa_*************************
RUNPOD_ENDPOINT_ID=i3qcf6gz8v495h
```

## 5. Database (D1)
**Binding:** `DB`
**Table:** `jobs` (Updated 14 Jan 2026)

```sql
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  runpod_job_id TEXT, -- RunPod ID (หลัง Submit สำเร็จ)
  status TEXT,        -- queued, running, done, failed
  prompt TEXT,
  model TEXT,         -- default: 'qwen-image'
  ratio TEXT,         -- "1:1", "9:16", "16:9"
  image_url TEXT,     -- URL รูปต้นฉบับ (จาก R2/Upload)
  result_r2_key TEXT, -- Patch ใน R2
  result_url TEXT,    -- Public URL ของผลลัพธ์
  finished_at TEXT,
  error_message TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

**Note:** มี Endpoint `/dev/migrate` สำหรับ Auto-add column ที่ขาดหาย

## 6. R2 Storage 🪣
- **Binding:** `R2_RESULTS`
- **Bucket:** `ob-ai-results`
- **Structure:**
    - Uploads: `uploads/{YYYY}/{MM}/{job_id}.png`
    - Results: `jobs/{YYYY}/{MM}/{job_id}/output.png`

## 7. Frontend V2 (Cloudflare Pages) 🖥️
**Update Features:**
- **Split Layout:** ซ้าย Control Panel, ขวา Preview/Progress
- **Input:** Drag & Drop Image, Prompt Textarea, Ratio Select
- **Feedback:** Real-time upload progress, Fake generation progress (0-99%)
- **Result:** Show generated image when status = `done`

**Flow:**
1. User Uploads Image + Prompt
2. Frontend calls `POST /api/queue/create` (Multipart)
3. Backend uploads to R2, saves to DB, and **Auto-Submits to RunPod**
4. Frontend receives Job ID and starts polling `GET /api/queue/status`
5. Show Result when ready

## 8. Current End-to-End Flow
1.  **User Action:** Upload Image + Prompt -> `POST /api/queue/create`
2.  **Backend (Queue):**
    - Upload Image -> R2 (`uploads/...`)
    - Insert DB (`queued`)
    - `ctx.waitUntil` -> **Submit to RunPod**
    - Update DB (`running` + `runpod_job_id`)
3.  **Cron Worker (Background):**
    - Runs every 1 min (Loop check every 15s)
    - Checks RunPod Status
    - If `COMPLETED`: Download Image -> Upload to R2 (`jobs/...`) -> Update DB (`done`)
4.  **Frontend Poll:**
    - Checks status every 3s
    - If `done`: Display Image

## 9. สิ่งที่ทำสำเร็จแล้ว ✅
- **Infrastructure:** D1, R2, Cron, Worker Deploy ผ่านหมด
- **Frontend V2:** High-fidelity UI, Responsive, Animations
- **Auto-Pipeline:** ไม่ต้องกด Submit แยก, Upload ปุ๊บไป RunPod ปั๊บ
- **Resilience:** Migration Tool, Error Handling, Retry Logic

## 10. Next Steps (To Do)
- **Debug:** แก้ปัญหา 400 Bad Request จาก RunPod (คาดว่า Payload หรือ Header)
- **Refinement:** ปรับปรุง Error Message บน UI ให้ User เข้าใจง่าย
- **Performance:** พิจารณาใช้ WebSocket หาก Polling หน่วงเกินไป (อนาคต)
