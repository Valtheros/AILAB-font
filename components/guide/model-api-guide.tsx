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
  return <section id="model-api" className="scroll-mt-20 space-y-3 border-y py-5">
    <h2 className="text-lg font-semibold">{thai ? "เผยแพร่ Model App" : "Publish a Model App"}</h2>
    <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
      <li>{thai ? "เปิด Model Apps จากเมนู กดสร้าง Model App แล้วเลือกงานที่เทรนสำเร็จ ตั้งชื่อและชื่อในลิงก์ หรือเพิ่มเป็นเวอร์ชันของแอปเดิม" : "Open Model Apps from the menu, choose Create Model App, and select a completed run. Enter a name and URL name, or add a version to an existing app."}</li>
      <li>{thai ? "เปิดทดสอบเวอร์ชัน ส่งรูปและรอให้ทำนายสำเร็จ กลับหน้า Model Apps แล้วกดใช้เวอร์ชันนี้" : "Open Preview, submit an image, and wait for a successful prediction. Return to Model Apps and publish that version."}</li>
      <li>{thai ? "คัดลอกลิงก์ /apps/user-id/model-name ผู้รับต้องล็อกอิน AILAB รูปและผลแยกเป็นส่วนตัวของผู้ส่ง ไม่เปิด dataset หรือ weights" : "Share /apps/user-id/model-name. Visitors must sign in to AILAB. Each visitor's input and output stay private; datasets and weights are not exposed."}</li>
    </ol>
    <p className="text-sm text-muted-foreground">{thai ? "งานใช้คิว GPU และโควตาพื้นที่ของเจ้าของโมเดลร่วมกับ Train ไม่ใช่บริการตอบทันที หนึ่งงานรับหนึ่งรูปไม่เกิน 10 MiB และ 25 ล้านพิกเซล ผลหมดอายุใน 24 ชั่วโมงหลังงานจบ ปิดเผยแพร่หยุดเฉพาะงานใหม่ เปลี่ยนหรือย้อนเวอร์ชันได้โดยไม่เปลี่ยนงานที่เข้าคิวแล้ว" : "App predictions share the model owner's GPU queue and storage quota with training; responses are not immediate. Each request accepts one image up to 10 MiB and 25 million pixels. Results expire 24 hours after completion. Unpublishing stops only new submissions. Switching or rolling back versions does not change queued requests."}</p>
    <h2 className="text-lg font-semibold">{thai ? "ใช้งานโมเดลผ่าน API" : "Use a model through the API"}</h2>
    <p className="text-sm text-muted-foreground">{thai ? "เปิด Model Apps แล้วเลือกแท็บ API เลือกงานที่เทรนสำเร็จ กดเปิด Model API และสร้าง key ซึ่งแสดงเพียงครั้งเดียว เก็บ key เป็นความลับและใช้เฉพาะผ่าน HTTPS จัดการ API เดิมได้โดยเลือกงานเดิม" : "Open Model Apps and select the API tab. Choose a completed run, enable Model API, and create a key, shown once. Keep the key secret and use HTTPS. Select the same run to manage an existing API."}</p>
    <p className="text-sm text-muted-foreground">{thai ? "คำขอจะเข้าคิวและคืน 202 พร้อม job ID นำ MODEL_ID จากแท็บ API และ JOB_ID จากผลตอบกลับมาแทนในตัวอย่าง" : "Requests are queued and return 202 with a job ID. Replace MODEL_ID with the ID in the API tab and JOB_ID with the returned ID."}</p>
    {commands.map((command) => <pre key={command} className="overflow-x-auto rounded border bg-muted p-3 text-xs"><code>{command}</code></pre>)}
    <p className="text-sm text-muted-foreground">{thai ? "ส่งหลายภาพผ่าน /predict-batch โดยใช้ files หลายรายการหรือ ZIP หนึ่งไฟล์ สูงสุด 100 ภาพ ภาพละ 10 MiB และรวมไม่เกิน 1 GiB ใช้ Idempotency-Key เดิมเฉพาะเมื่อลองส่งคำขอเดิมซ้ำ ผลทำนายและไฟล์จะหมดอายุหลังงานจบ 24 ชั่วโมง" : "Use /predict-batch with multiple files fields or one ZIP: up to 100 images, 10 MiB each and 1 GiB total. Reuse an Idempotency-Key only to retry the same request. Results and files expire 24 hours after completion."}</p>
    <p className="text-sm text-muted-foreground">{thai ? "400: ข้อมูลหรือ ZIP ไม่ถูกต้อง · 401: key ไม่ถูกต้อง หมดอายุ หรือถูกเพิกถอน · 404: ไม่พบโมเดล/งานที่ key นี้เข้าถึงได้ · 409: งานยังไม่พร้อม endpoint ปิด หรือ key คำขอซ้ำกับข้อมูลที่ต่างกัน · 410: ผลหมดอายุ · 413: ไฟล์ใหญ่เกินกำหนด · 422: ขาดช่องบังคับหรือรูปแบบคำขอไม่ถูกต้อง เช่น ไม่ส่งไฟล์ · 429: เกินอัตราที่กำหนด ให้รอตาม Retry-After · 503: บริการยังไม่พร้อม" : "400: invalid input or ZIP · 401: invalid, expired or revoked key · 404: model or job is not accessible to this key · 409: job is not ready, endpoint is disabled, or the request key was reused with different input · 410: result expired · 413: file too large · 422: a required field is missing or malformed, such as a missing file · 429: rate limit exceeded; retry after the Retry-After value · 503: service unavailable."}</p>
  </section>;
}
