# Logging Schema v1 (Final)

## Format
- JSON 1 บรรทัดต่อเหตุการณ์
- ทุก log ต้อง redaction ก่อนเขียนเมื่อมี headers/payload

## Required Fields
- `ts`: ISO timestamp
- `level`: info | warn | error
- `service`: เช่น ob-ai-api
- `env`: local | staging | production
- `requestId`
- `trace_id`
- `sessionId` (optional)
- `userId` (optional)
- `jobId` (optional)
- `runpodRequestId` (optional)
- `runpod_endpoint_id` (optional)
- `workflow_version` (optional)
- `worker_image_tag` (optional)
- `route`
- `method`
- `status`
- `latencyMs`
- `runpod_queue_duration_ms` (optional)
- `runpod_run_duration_ms` (optional)
- `total_duration_ms` (optional)
- `runpod_wait_duration_ms` (optional)
- `end_to_end_duration_ms` (optional)
- `event`
- `message`
- `payloadHash`
- `payloadSizeBytes`
- `redactionApplied`
- `error`: { type, code, stack?, details?, provider_error? }

## Event Enum (ตัวอย่าง)
- `api.request`
- `api.response`
- `runpod.request`
- `runpod.response`
- `runpod.webhook.completed`
- `runpod.webhook.failed`
- `job.queued`
- `job.running`
- `job.completed`
- `job.failed`
- `r2.put`
- `r2.get`
- `metrics.job`

## Frontend Observability (Docs Only)
- ใช้ `trace_id` จาก response ของ API เพื่อผูกกับ UI state
- บันทึก `job_id` และ `runpod_id` ใน client log (console/debug)
- อ้างอิง API contract: `docs/WORKFLOW_CONTRACT_V1.md`

## Example Logs (1 line each)
{"ts":"2026-01-16T00:12:11.120Z","level":"info","service":"ob-ai-api","env":"staging","requestId":"req-1","trace_id":"req-1","route":"/api/queue/create","method":"POST","status":200,"latencyMs":12,"event":"api.request","message":"queue create received","payloadHash":"f1a2b3","payloadSizeBytes":412,"redactionApplied":false}
{"ts":"2026-01-16T00:12:11.340Z","level":"info","service":"ob-ai-api","env":"staging","requestId":"req-1","trace_id":"req-1","jobId":"job-123","runpodRequestId":"rp-456","runpod_endpoint_id":"ep-789","workflow_version":"v1.0.0","worker_image_tag":"v1.0.1","event":"runpod.request","message":"submit to runpod","payloadHash":"a9c12d","payloadSizeBytes":8203,"redactionApplied":true}
{"ts":"2026-01-16T00:12:12.102Z","level":"info","service":"ob-ai-api","env":"staging","requestId":"req-1","trace_id":"req-1","jobId":"job-123","runpodRequestId":"rp-456","event":"runpod.response","status":200,"latencyMs":762,"payloadHash":"b8f331","payloadSizeBytes":512,"redactionApplied":false}
{"ts":"2026-01-16T00:12:46.300Z","level":"info","service":"ob-ai-api","env":"staging","requestId":"req-2","trace_id":"req-2","jobId":"job-123","event":"runpod.webhook.completed","message":"job completed","status":200,"total_duration_ms":34000,"payloadHash":"c21d09","payloadSizeBytes":128,"redactionApplied":false}
{"ts":"2026-01-16T00:12:46.520Z","level":"info","service":"ob-ai-api","env":"staging","requestId":"req-2","trace_id":"req-2","jobId":"job-123","event":"r2.put","message":"result stored","payloadHash":"d90ac1","payloadSizeBytes":1024,"latencyMs":120,"redactionApplied":false}
{"ts":"2026-01-16T00:12:47.010Z","level":"error","service":"ob-ai-api","env":"staging","requestId":"req-3","trace_id":"req-3","jobId":"job-999","event":"job.failed","message":"runpod failed","status":502,"redactionApplied":true,"error":{"type":"RunPodError","code":"RUNPOD_FAILED","provider_error":"Missing workflow parameter"}}
