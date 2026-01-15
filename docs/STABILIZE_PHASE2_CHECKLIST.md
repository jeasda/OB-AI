# Phase 2 Production Hardening Checklist

## RunPod Worker (Staging + Prod)
- [ ] STAGING endpoint created and configured separatelyจาก PROD
- [ ] IMAGE tag สำหรับ STAGING ถูก deploy ผ่าน pipeline
- [ ] STAGING ผ่าน Golden Tests ทั้งหมดก่อน promote
- [ ] PROD รับการ promote จาก tag เดียวกัน (immutable)
- [ ] Rollback พร้อมใช้งาน (pin tag เดิม)

## Workflow / Models
- [ ] Workflow version tag ระบุชัดใน env `WORKFLOW_VERSION`
- [ ] โมเดลครบและชื่อไฟล์ตรงกับ workflow
- [ ] ไม่มีการพึ่ง Network Volume ใน production
- [ ] cold start ไม่ทำให้ workflow ล้มเหลว

## API / Queue
- [ ] POST `/api/queue/create` ส่งงานได้
- [ ] POST `/api/runpod/webhook` รับ COMPLETED/FAILED ได้
- [ ] ไม่มี automated polling ใน live flow (ใช้ manual recovery เท่านั้น)
- [ ] Status endpoint ตอบ completed เมื่อ webhook อัปเดต
- [ ] Webhook idempotency ทำงานและ out-of-order ถูก ignore

## Storage (R2)
- [ ] Result upload สำเร็จและเรียกผ่าน `/api/result/:key`
- [ ] ตรวจขนาดไฟล์และ Content-Type

## Observability
- [ ] Logging schema v1 ครบทุกจุด
- [ ] มี trace_id, workflow_version, worker_image_tag
- [ ] runpod_queue_duration_ms/runpod_run_duration_ms ถูกบันทึก (ถ้ามี)
- [ ] Metrics ถูกบันทึกใน D1 (job_metrics) และคำนวณ P50/P95/P99 ได้
- [ ] มี cost_estimate_usd ต่อ job สำหรับการประเมินคร่าวๆ

## Golden Tests
- [ ] รัน `scripts/golden-tests/run.mjs` กับ STAGING
- [ ] Report ล่าสุดอยู่ที่ `scripts/golden-tests/reports/latest.json`
- [ ] Latency <= threshold ที่กำหนด

## Release Readiness
- [ ] Pipeline deploy/promote ผ่านทุกขั้นตอน
- [ ] ไม่มี error rate เกินเกณฑ์
- [ ] Rollback ผ่าน smoke test
- [ ] DR drill ผ่านตามเอกสาร `docs/D1_DISASTER_RECOVERY.md`

## Exit Criteria
- [ ] ทุก job COMPLETED และได้ผลลัพธ์ภาพ
- [ ] Latency เฉลี่ย <= 6 นาที
- [ ] ไม่มี Network Volume ใน production
- [ ] Golden Tests ผ่านครบทุกเคส

## Debug First Aid: "No checkpoint models appear to be available"
- [ ] เช็ค path `/comfyui/models` และ `/workspace/ComfyUI/models`
- [ ] ยืนยันไฟล์ UNET/CLIP/VAE/LoRA ครบตาม workflow
- [ ] ดู startup log ว่ามีข้อความโหลดโมเดลสำเร็จ
- [ ] หากเป็น serverless ให้ rebuild image พร้อมโมเดล
