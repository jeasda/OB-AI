# Workflow Contract Enforcement (v1)

## Purpose
- ป้องกัน payload ที่ผิด schema ก่อนส่งไป RunPod
- ลดความเสี่ยง workflow mismatch และ error ที่ตรวจยาก

## Enforcement Points
- Endpoint: POST `/api/queue/create`
- ตรวจ `service`, `prompt`, `ratio`, `image`
- ถ้าไม่ผ่านจะตอบ `400` พร้อม error code `workflow contract violation`

## Error Log
- Event: `workflow_contract.violation`
- Fields: `requestId`, `trace_id`, `errors`, `workflow_version`, `worker_image_tag`

## Contract Test Script
```bash
node scripts/contracts/validate_workflow_contract.mjs
```

## Notes
- Contract schema อิงตาม `docs/WORKFLOW_CONTRACT_V1.md`
- เพิ่ม field ใหม่ต้องอัปเดตทั้ง docs และ validator
