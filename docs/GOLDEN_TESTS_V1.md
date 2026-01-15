# Golden Tests v1 (Qwen Image Edit)

## เป้าหมาย
- ตรวจจับการหลุดตัวตน (identity drift)
- ตรวจจับ workflow หรือ API contract ที่พัง
- วัด latency และความเสถียร

## Test Cases (GT01 - GT07)

### GT01_identity_lock
- Purpose: ล็อกตัวตนและไม่เปลี่ยนองค์ประกอบ
- Inputs: ไม่เปลี่ยนทุกค่า, ratio portrait
- Required workflow: qwen-image-edit v1.0.0
- Expected: ใบหน้าตรงกับต้นฉบับ ไม่มีการเปลี่ยนชุด/ฉากหลัง
- Max latency: 6 นาที
- Pass/Fail: Completed + ได้ภาพ + latency <= threshold

### GT02_outfit_only
- Purpose: เปลี่ยนชุดอย่างเดียว
- Inputs: ชุดราตรีงานเลี้ยง, อื่นๆ ไม่เปลี่ยน
- Expected: ชุดเปลี่ยนชัดเจน ฉากหลังเดิม

### GT03_location_only
- Purpose: เปลี่ยนสถานที่อย่างเดียว
- Inputs: ทะเล, อื่นๆ ไม่เปลี่ยน, ratio landscape
- Expected: ฉากหลังทะเลชัดเจน

### GT04_mood_sensitivity
- Purpose: ความไวต่ออารมณ์เศร้า
- Inputs: mood เศร้า, อื่นๆ ไม่เปลี่ยน
- Expected: สีหน้าดูเศร้า แต่ตัวตนเดิม

### GT05_candid_pose
- Purpose: ท่าทางเดินท่องเที่ยว
- Inputs: ชุดไปเที่ยว + ต่างประเทศ + เดินท่องเที่ยว + ยิ้มน้อยๆ
- Expected: ท่าทางดูเป็นธรรมชาติ ฉากหลังต่างประเทศ

### GT06_minimal_change
- Purpose: เปลี่ยนน้อยที่สุด
- Inputs: ไม่เปลี่ยนยกเว้น mood หน้าเรียบเฉย, ratio square
- Expected: เปลี่ยนเล็กน้อย ไม่หลุดตัวตน

### GT07_stress_test
- Purpose: เปลี่ยนหลายองค์ประกอบพร้อมกัน
- Inputs: ชุดไฮโซ + ภูเขาทะเลหมอก + แบกเป้เดินทาง + ดีใจ
- Expected: ทุกองค์ประกอบสะท้อนชัดเจน

## Active Workflow Definition
Workflow จะถือว่า ACTIVE เมื่อ:
- Golden Tests ทั้งหมดผ่าน (GT01-GT07)
- Latency เฉลี่ยไม่เกิน threshold
- ไม่มี error ใน API contract

## Artifacts
- Test cases: `scripts/golden-tests/cases.v1.json`
- Runner: `scripts/golden-tests/run.mjs`
- Reports: `scripts/golden-tests/out/<run-id>/report.*`
- Latest report: `scripts/golden-tests/reports/latest.json`
 - Environment label: set `GT_ENV=staging|production`

## Troubleshooting (Flaky Tests)
- ตรวจ input image ว่าชัดและมีใบหน้าครบ
- ตรวจ endpoint ของ RunPod ว่าใช้ image tag ถูกต้อง
- ลองเพิ่ม timeout หรือ poll interval ใน env
- ตรวจ log schema v1 เพื่อดูจุดล้มเหลว
