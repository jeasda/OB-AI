# D1 Disaster Recovery Drill (Phase 2)

## เป้าหมาย
- สำรองข้อมูล D1 และกู้คืนได้ภายใน RTO ที่กำหนด
- ตรวจสอบความถูกต้องของข้อมูลหลัก (jobs, webhook_events, job_metrics)

## RPO / RTO (สมมติฐาน Phase 2)
- RPO: 24 ชั่วโมง
- RTO: 4 ชั่วโมง

## Backup (Export)
```bash
npx wrangler d1 export ob-ai-api-dev --output out/d1-backups/backup.sql
```

## Restore (Import)
```bash
npx wrangler d1 create ob-ai-api-restore
npx wrangler d1 import ob-ai-api-restore --file out/d1-backups/backup.sql
```

## Verify Integrity
```bash
npx wrangler d1 execute ob-ai-api-restore --command "SELECT COUNT(*) FROM jobs"
npx wrangler d1 execute ob-ai-api-restore --command "SELECT COUNT(*) FROM webhook_events"
npx wrangler d1 execute ob-ai-api-restore --command "SELECT COUNT(*) FROM job_metrics"
```

## DR Drill Checklist
- [ ] Export สำเร็จและมีไฟล์ backup.sql
- [ ] Import เข้า DB ใหม่สำเร็จ
- [ ] Count ตารางหลักตรงตามที่คาด
- [ ] บันทึกเวลาเริ่ม/จบ และผลลัพธ์

## Helper Script
```bash
node scripts/dr/d1_backup_restore.mjs
```
