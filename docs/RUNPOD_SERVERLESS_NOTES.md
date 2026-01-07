# RunPod Serverless: สรุปและคำอธิบาย

## RunPod Serverless คืออะไร?
RunPod Serverless คือบริการ Cloud Computing สำหรับงาน AI ที่เน้นการ **"จ่ายตามจริงเมื่อใช้งาน" (Pay-as-you-go)** หมายความว่าคุณจะมี GPU แรงๆ ไว้รัน Model ของคุณ แต่คุณจะเสียเงินเฉพาะวินาทีที่มันทำงานเท่านั้น เวลาที่ไม่มีใครใช้งาน (Idle) ระบบจะปิดตัวเองและคุณก็ไม่ต้องจ่ายเงิน

เหมาะมากสำหรับแอปพลิเคชันอย่าง **RunningHub** ที่การใช้งานอาจจะไม่ได้เกิดขึ้นตลอดเวลา 24 ชั่วโมง

## คอนเซปต์หลัก (Core Concepts)

### 1. Endpoints (ประตูทางเข้า)
เปรียบเสมือน URL API ของคุณ เมื่อ Frontend หรือ Proxy ต้องการใช้งาน AI มันจะส่ง Request มาที่นี่ `Endpoint` จะทำหน้าที่รับงานแล้วแจกจ่ายไปให้ `Worker` ทำต่อ

### 2. Workers (คนทำงาน)
คือ Container ที่รันโค้ดของคุณ (ในที่นี้คือ **ComfyUI**)
- เมื่อมีงานเข้า: RunPod จะปลุก Worker ขึ้นมาทำงาน
- เมื่อหมดงาน: Worker จะรอสักพัก (เผื่อมีงานต่อ) ถ้าไม่มีก็จะปิดตัวลง (Scale down to zero)

### 3. Handler Functions
คือฟังก์ชันด่านหน้าใน Worker ที่คอยรับ Input จาก Endpoint แล้วส่งต่อให้ AI ประมวลผล จากนั้นส่งผลลัพธ์กลับ
สำหรับ ComfyUI มักจะมี Handler พิเศษที่ทำหน้าที่รับ JSON Workflow แล้วไปสั่ง ComfyUI ให้ทำงาน

### 4. Cold Start (การบูทเครื่อง)
คือช่วงเวลา "ดีเลย์" เมื่อมีงานเข้ามาในขณะที่ไม่มี Worker เปิดอยู่เลย (0 active workers)
- ระบบต้องใช้เวลาในการ start container และ load model เข้า GPU Memory
- **ผลกระทบ**: User คนแรกที่ใช้งานหลังจากระบบหยุดไปนาน อาจจะต้องรอนานกว่าปกติเล็กน้อย (หลักวินาที ถึงนาที ขึ้นอยู่กับขนาด Model)
- **การแก้ไข**: สามารถตั้งค่า `Active Model` ขั้นต่ำไว้ได้ (แต่เสียเงินตลอด) หรือใช้เทคนิค Caching

## รูปแบบการ Deploy

สำหรับโปรเจกต์นี้ เราน่าจะตกอยู่ในหมวด **Build a custom worker** หรือ **Fork a worker template**:
- เราใช้ **ComfyUI** ซึ่งต้องมีการลง Node พิเศษ (Qwen) และ Model เฉพาะ
- เราจึงต้องสร้าง Docker Image ของเราเองที่มีทุกอย่างพร้อม แล้วนำไป Deploy บน RunPod Serverless

## สรุปความเกี่ยวข้องกับโปรเจกต์ RunningHub
1.  **Frontend** ส่งรูปไปที่ **Cloudflare Proxy**.
2.  **Proxy** ส่ง Request ไปที่ **RunPod Endpoint**.
3.  **RunPod** ปลุก **Worker (ComfyUI)** จากโหมดหลับ (Cold Start ถ้าจำเป็น).
4.  **Worker** เจนรูปเสร็จ ส่งกลับมา แล้วก็หลับไปเพื่อประหยัดเงิน

อ่านรายละเอียดเต็มๆ ได้ที่ [RunPod Documentation](https://docs.runpod.io/)
