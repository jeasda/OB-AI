# Frontend API Contract V1 (Qwen Image Edit)

## Base
- Base URL: same origin
- All requests should include `trace_id` when available for observability (client-generated UUID)

## Create Job
`POST /api/queue/create`

### Request
- Content-Type: `multipart/form-data`
- Fields:
  - `service` (string) = `qwen-image-edit`
  - `prompt` (string)
  - `ratio` (string) = `square | landscape | portrait`
  - `model` (string) = `qwen-image`
  - `image` (file)
  - `options` (stringified JSON)

### Response (success)
```json
{
  "ok": true,
  "job_id": "uuid"
}
```

### Response (error)
```json
{
  "ok": false,
  "error": "message",
  "code": "error_code"
}
```

## Status
`GET /api/queue/status/{job_id}`

### Response (success)
```json
{
  "ok": true,
  "job": {
    "id": "uuid",
    "status": "queued | running | completed | failed",
    "result_key": "r2_key_or_null",
    "error": "error_message_or_null"
  },
  "result_url": "/api/result/{result_key}"
}
```

## Result
`GET /api/result/{result_key}`

### Response (success)
- Returns image bytes (png/jpg)

## Error Schema
- `ok`: boolean
- `error`: string (user-readable summary)
- `code`: string (machine-readable error identifier)
- `trace_id`: optional string (if backend returns)

## Trace ID propagation
- Generate a `trace_id` on the client and include it in future requests when backend supports it.
- Log and surface the `trace_id` to help debugging failed jobs.
