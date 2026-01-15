# RunPod Webhooks (Completion Callback)

## Endpoint
- POST `/api/runpod/webhook`

## Security
- Set secret in Worker env: `RUNPOD_WEBHOOK_SECRET`
- RunPod must include header:
  - `x-runpod-webhook-secret: <secret>`
  - (fallback) `x-webhook-secret: <secret>`
- Configure webhook URL + secret ใน RunPod endpoint settings
- (optional) HMAC header: `x-runpod-signature` (HMAC SHA256 ของ raw body)

## Enable/Disable
- `RUNPOD_WEBHOOK_ENABLED=true` (default)
- `RUNPOD_WEBHOOK_ENABLED=false` เพื่อปิดและใช้ polling fallback

## Sample Payload (COMPLETED)
```json
{
  "id": "runpod-job-id",
  "status": "COMPLETED",
  "output": {
    "image_base64": "..."
  },
  "queue_delay_ms": 1200,
  "execution_time_ms": 28000
}
```

## Sample Payload (FAILED)
```json
{
  "id": "runpod-job-id",
  "status": "FAILED",
  "error": "No checkpoint models appear to be available"
}
```

## Notes
- Webhook จะอัปเดต D1 และบันทึกผลลัพธ์ไป R2
- Frontend ใช้ `/api/queue/status/:id` เพื่อดูสถานะ
- Polling เป็น fallback เท่านั้น
