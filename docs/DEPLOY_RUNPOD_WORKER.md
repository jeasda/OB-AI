# DEPLOY RunPod Worker (Phase 2 Production Hardening)

## แนวทางหลัก (Automation)
ใช้ pipeline script เพื่อ build/push/deploy/validate/promote แบบอัตโนมัติ

### Pipeline Command
```bash
RUNPOD_API_KEY=... \
RUNPOD_ENDPOINT_ID_STAGING=... \
RUNPOD_ENDPOINT_ID_PROD=... \
DOCKER_IMAGE=ob-ai/qwen-image-edit \
DOCKER_TAG=v1.0.2 \
RUNPOD_ENDPOINT_IMAGE_FIELD=containerImage \
STAGING_BASE_URL=https://staging-worker.example.com \
node scripts/deploy/runpod_pipeline.mjs
```

Pipeline จะทำ:
1) build image
2) push image
3) deploy ไป STAGING endpoint
4) run Golden Tests กับ STAGING
5) promote tag เดียวกันไป PROD ถ้าผ่าน

หมายเหตุ: หาก RunPod schema ใช้ field อื่นสำหรับ image ให้ตั้ง `RUNPOD_ENDPOINT_IMAGE_FIELD`

## Break-glass (Manual Only)
ใช้เมื่อ pipeline ล้มเหลวเท่านั้น

### Build Image
```bash
TAG=v1.0.2
LATEST=v1

docker build -t ob-ai/qwen-image-edit:$TAG -f Dockerfile .
docker tag ob-ai/qwen-image-edit:$TAG ob-ai/qwen-image-edit:$LATEST
```

### Push Image
```bash
docker login
docker push ob-ai/qwen-image-edit:$TAG
docker push ob-ai/qwen-image-edit:$LATEST
```

### Update Endpoint (Manual)
1. RunPod Console > Serverless > Endpoints
2. เลือก endpoint
3. เปลี่ยน Image tag
4. Deploy/Restart

## Rollback
```bash
RUNPOD_API_KEY=... \
RUNPOD_ENDPOINT_ID_PROD=... \
DOCKER_IMAGE=ob-ai/qwen-image-edit \
DOCKER_TAG=v1.0.1 \
node scripts/deploy/runpod_pipeline.mjs rollback
```
ไฟล์ล่าสุดของ prod image จะถูกบันทึกไว้ที่ `scripts/deploy/last_prod_image.txt`

## Versioning + Cleanup Policy
- Tag แบบ semantic-ish: `v1.0.1`, `v1.0.2`
- `v1` ใช้เป็น pointer เท่านั้น
- เก็บอย่างน้อย 3 เวอร์ชันล่าสุด

## Model Packaging Strategy
- Strategy A: per-model image (Qwen Image Edit แยก image)
- ขยาย multi-model ได้ด้วย endpoint แยก
