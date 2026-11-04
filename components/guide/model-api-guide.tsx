"use client";

import { useLanguage } from "@/components/language-provider";

export function ModelApiGuide() {
  const { language } = useLanguage(); const thai = language === "th";
  const commands = [
    'curl -X POST "https://ai-lab.cs.psu.ac.th/api/v1/models/MODEL_ID/predict" -H "Authorization: Bearer $AILAB_API_KEY" -H "Idempotency-Key: request-1" -F "file=@image.jpg"',
    'curl -X POST "https://ai-lab.cs.psu.ac.th/api/v1/models/MODEL_ID/predict-batch" -H "Authorization: Bearer $AILAB_API_KEY" -H "Idempotency-Key: batch-1" -F "files=@image-1.jpg" -F "files=@image-2.jpg"',
    'curl -H "Authorization: Bearer $AILAB_API_KEY" "https://ai-lab.cs.psu.ac.th/api/v1/jobs/JOB_ID"',
    'curl -H "Authorization: Bearer $AILAB_API_KEY" "https://ai-lab.cs.psu.ac.th/api/v1/jobs/JOB_ID/result"',
    'curl -X POST -H "Authorization: Bearer $AILAB_API_KEY" "https://ai-lab.cs.psu.ac.th/api/v1/jobs/JOB_ID/cancel"',
  ];
  return <section className="space-y-3 border-y py-5">
    <h2 className="text-lg font-semibold">{thai ? "ใช้งานโมเดลผ่าน API" : "Use a model through the API"}</h2>
    <p className="text-sm text-muted-foreground">{thai ? "เมื่อระบบเปิด Model API แล้ว ให้เปิดใช้งานใน run ที่สำเร็จและสร้าง key ซึ่งแสดงเพียงครั้งเดียว เก็บ key เป็นความลับและใช้เฉพาะผ่าน HTTPS" : "Once Model API is available, enable it on a completed run and create a key, shown once. Keep the key secret and use HTTPS."}</p>
    <p className="text-sm text-muted-foreground">{thai ? "คำขอจะเข้าคิวและคืน 202 พร้อม job ID นำ MODEL_ID จากหน้า run และ JOB_ID จากผลตอบกลับมาแทนในตัวอย่าง" : "Requests are queued and return 202 with a job ID. Replace MODEL_ID with the ID on the run page and JOB_ID with the returned ID."}</p>
    {commands.map((command) => <pre key={command} className="overflow-x-auto rounded border bg-muted p-3 text-xs"><code>{command}</code></pre>)}
    <p className="text-sm text-muted-foreground">{thai ? "ส่งหลายภาพผ่าน /predict-batch โดยใช้ files หลายรายการหรือ ZIP หนึ่งไฟล์ สูงสุด 100 ภาพ ภาพละ 10 MiB และรวมไม่เกิน 1 GiB ใช้ Idempotency-Key เดิมเฉพาะเมื่อลองส่งคำขอเดิมซ้ำ ผลทำนายและไฟล์จะหมดอายุหลังงานจบ 24 ชั่วโมง" : "Use /predict-batch with multiple files fields or one ZIP: up to 100 images, 10 MiB each and 1 GiB total. Reuse an Idempotency-Key only to retry the same request. Results and files expire 24 hours after completion."}</p>
    <p className="text-sm text-muted-foreground">{thai ? "400: ข้อมูลหรือ ZIP ไม่ถูกต้อง · 401: key ไม่ถูกต้อง หมดอายุ หรือถูกเพิกถอน · 404: ไม่พบโมเดล/งานที่ key นี้เข้าถึงได้ · 409: งานยังไม่พร้อม endpoint ปิด หรือ key คำขอซ้ำกับข้อมูลที่ต่างกัน · 410: ผลหมดอายุ · 413: ไฟล์ใหญ่เกินกำหนด · 429: เกินอัตราที่กำหนด ให้รอตาม Retry-After · 503: บริการยังไม่พร้อม" : "400: invalid input or ZIP · 401: invalid, expired or revoked key · 404: model or job is not accessible to this key · 409: job is not ready, endpoint is disabled, or the request key was reused with different input · 410: result expired · 413: file too large · 429: rate limit exceeded; retry after the Retry-After value · 503: service unavailable."}</p>
  </section>;
}
