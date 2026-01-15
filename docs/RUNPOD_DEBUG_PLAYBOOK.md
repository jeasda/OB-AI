# RunPod Debug Playbook (Qwen Image Edit)

## Quick Isolate
1. ทดสอบ RunPod โดยตรง (ไม่ผ่าน Worker)
```bash
RUNPOD_API_KEY=... RUNPOD_ENDPOINT_ID=... node scripts/runpod/smoke_run.mjs
```
Expected: status 200 และ output มี image หรือ result_url

2. ตรวจ log ของ endpoint ใน RunPod Console
- ดู error: missing workflow, no checkpoint models, out of memory

3. ตรวจ path และไฟล์โมเดลใน container
```bash
ls -la /workspace/ComfyUI/models
ls -la /comfyui/models
```
Expected: มีไฟล์ .safetensors ครบตาม workflow

4. ตรวจ ComfyUI โหลดโมเดลสำเร็จ
- ดู startup log: ต้องไม่มี “No checkpoint models appear to be available”

## Model List Dump (ถ้ามี shell)
```bash
find /workspace/ComfyUI/models -type f | head -n 50
```

## ComfyUI Health
- เช็คว่ามีข้อความ “Server started” หรือ “Loaded model”
- ถ้าล้มเหลว ให้ตรวจชื่อไฟล์กับ workflow

## Known Failure: No checkpoint models appear to be available
- ยืนยันว่า model อยู่ในโฟลเดอร์ UNET และชื่อไฟล์ตรงกับ workflow
- ยืนยัน symlink /comfyui/models ไปยัง path จริง
- ถ้าเป็น serverless ให้ rebuild image และฝังโมเดล

## Success Signal
- RunPod status = COMPLETED
- output มี image_base64 หรือ result_url

## Manual Recovery Poller
ใช้เมื่อ webhook ไม่ถูกเรียก
```bash
RUNPOD_API_KEY=... RUNPOD_ENDPOINT_ID=... RUNPOD_JOB_ID=... \
WORKER_BASE_URL=https://your-worker.example.com \
RUNPOD_WEBHOOK_SECRET=... \
node scripts/runpod/recover_poll.mjs
```
