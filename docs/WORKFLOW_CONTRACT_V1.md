# Workflow Contract v1 (Platform)

## Input Schema
```json
{
  "service": "qwen-image-edit",
  "workflow_version": "v1.0.0",
  "prompt": "string",
  "ratio": "1:1 | 16:9 | 9:16",
  "options": {
    "clothes": "ไม่เปลี่ยน | ชุดไทย | ...",
    "location": "ไม่เปลี่ยน | คาเฟ่ | ...",
    "locationSub": "Chiang Mai | Paris | ...",
    "activity": "ไม่ระบุ | เดินท่องเที่ยว | ...",
    "activitySub": "ยืนธรรมชาติ | ...",
    "mood": "ถ่ายแบบ | เศร้า | ...",
    "ratioDisplay": "ภาพสี่เหลี่ยมจตุรัส | ..."
  },
  "image": {
    "base64": "..." ,
    "url": "..."
  },
  "clientRequestId": "uuid"
}
```

## Output Schema
```json
{
  "status": "queued | running | completed | failed",
  "images": [
    {
      "url": "https://...",
      "base64": null,
      "mime": "image/png"
    }
  ],
  "meta": {
    "jobId": "...",
    "runpodId": "...",
    "workflow_version": "v1.0.0",
    "latencyMs": 12345,
    "ratio": "9:16"
  },
  "billing": {
    "mode": "mock",
    "creditsUsed": 1
  }
}
```

## Notes
- ช่อง `image.base64` และ `image.url` ใช้ได้อย่างใดอย่างหนึ่ง
- หากใช้ `url` ต้องเป็น public URL ที่ worker เข้าถึงได้
- Billing เป็น mock เท่านั้นใน Phase 2
