export type ExecutionSelection = { mode: "auto" | "gpu" | "cpu"; gpuUuid?: string | null; needsSelection?: boolean };
export type ComputeDevice = { uuid: string; name: string; totalMb: number; freeMb: number; status: string; utilization: number; temperature: number; error?: string; draining: boolean };
export type ComputeAvailability = { status: 'loading' | 'error' | 'ready'; devices: ComputeDevice[]; cpuAvailable: boolean; coordinatorAvailable: boolean };
export const initialComputeAvailability: ComputeAvailability = { status: 'loading', devices: [], cpuAvailable: false, coordinatorAvailable: false };
export function executionReadiness(selection: ExecutionSelection, availability: ComputeAvailability): 'loading' | 'unavailable' | 'offline' | 'ready' | 'busy' {
  if (availability.status === 'loading') return 'loading';
  if (availability.status === 'error') return 'unavailable';
  if (!availability.coordinatorAvailable) return 'offline';
  if (selection.mode === 'cpu') return availability.cpuAvailable ? 'ready' : 'offline';
  const candidates = availability.devices.filter((device) => selection.mode === 'auto' || device.uuid === selection.gpuUuid);
  if (candidates.some((device) => device.status === 'ready')) return 'ready';
  if (candidates.some((device) => device.status === 'busy')) return 'busy';
  return 'offline';
}
export type ComputeJob = { id: string; kind: string; status: string; queueReason?: string; errorCode?: string; error?: string; inputName?: string; inputBytes?: number; assignedGpu?: { uuid: string; name?: string }; requestedExecution: ExecutionSelection; progress?: { current: number; total: number }; expiresAt?: string | null };

const messages: Record<string, [string, string]> = {
  user_quota: ["Your GPU job quota is full", "โควตางาน GPU ของคุณเต็ม กำลังรอให้งานก่อนหน้าจบ"],
  node_resources: ["Waiting for host RAM or CPU capacity", "กำลังรอ RAM หรือ CPU ของเครื่องให้เพียงพอ"],
  gpu_busy_or_offline: ["Waiting for an available GPU worker", "กำลังรอการ์ดหรือ worker ที่พร้อมทำงาน"],
  cpu_busy_or_offline: ["Waiting for the CPU worker", "กำลังรอ CPU worker"],
  gpu_busy: ["Waiting for the requested GPU to become idle", "กำลังรอ GPU ที่ร้องขอให้ว่าง"],
  gpu_memory_busy: ["Waiting for sufficient free GPU memory", "กำลังรอหน่วยความจำ GPU ว่างเพียงพอ"],
  gpu_draining: ["GPU is draining; waiting for the administrator", "GPU หยุดรับงานใหม่ชั่วคราว กำลังรอผู้ดูแล"],
  cpu_busy: ["Waiting for the CPU worker to finish its current job", "กำลังรอ CPU worker ทำงานปัจจุบันให้จบ"],
  COMPUTE_DISABLED: ["Compute workers are unavailable. The task was not started; contact an administrator and retry.", "ระบบ compute ยังไม่พร้อม งานนี้ยังไม่ได้เริ่ม กรุณาติดต่อผู้ดูแลแล้วลองใหม่"],
  COMPUTE_FAILED: ["The job failed. See its log for the cause.", "งานไม่สำเร็จ ดูสาเหตุเพิ่มเติมใน log ของงาน"],
  INVALID_EXECUTION: ["Select Auto GPU, a GPU, or CPU.", "กรุณาเลือก Auto GPU, การ์ด GPU หรือ CPU"],
  GPU_SELECTION_REQUIRED: ["Select the GPU again. Its previous index cannot be identified.", "กรุณาเลือก GPU อีกครั้ง ระบบระบุการ์ดจากเลข index เดิมไม่ได้"],
  GPU_NOT_CONFIGURED: ["No matching GPU is configured. Select CPU or contact an administrator.", "ยังไม่มี GPU ที่เลือกในระบบ เลือก CPU หรือติดต่อผู้ดูแล"],
  GPU_MEMORY_LIMIT: ["This configuration exceeds the GPU memory estimate. Reduce batch or image size.", "ค่าประมาณหน่วยความจำเกินขนาด GPU ลองลด batch หรือขนาดภาพ"],
  QUEUE_LIMIT: ["Too many pending jobs. Cancel a job or wait for it to finish.", "มีงานรอมากเกินกำหนด กรุณายกเลิกบางงานหรือรอให้งานจบ"],
  RUN_IN_USE: ["Cancel active Train and Test jobs before deleting the run.", "กรุณายกเลิกงาน Train และ Test ที่ยังทำงานก่อนลบ run"],
  INVALID_IMAGE: ["This image cannot be read. Upload a valid image.", "อ่านรูปภาพไม่ได้ กรุณาอัปโหลดไฟล์ภาพที่สมบูรณ์"],
  INVALID_BATCH: ["The images or ZIP are invalid. Select up to 100 images, at most 10 MiB each and 1 GiB total.", "ชุดภาพหรือ ZIP ไม่ถูกต้อง กรุณาเลือกไม่เกิน 100 รูป รูปละไม่เกิน 10 MiB และรวมไม่เกิน 1 GiB"],
  USER_RESOURCES_DELETING: ["Account resources are being removed. Contact an administrator.", "บัญชีกำลังล้างข้อมูล กรุณาติดต่อผู้ดูแล"],
  worker_offline: ["Worker offline; resources remain reserved", "Worker ขาดการเชื่อมต่อ กำลังตรวจสอบก่อนคืนทรัพยากร"],
  GPU_OOM: ["GPU memory was exhausted. Reduce batch size or image size.", "หน่วยความจำ GPU เต็ม ลองลด batch size หรือขนาดภาพ"],
  WORKER_KILLED: ["Worker process was killed, possibly by the RAM limit.", "Process ถูกหยุด อาจเกิดจากใช้ RAM เกินขีดจำกัด"],
  WORKER_INTERRUPTED: ["Worker restarted. Checkpoints and logs remain available. Train again to create a new run.", "Worker หยุดหรือเริ่มใหม่ ยังเก็บ checkpoint และ log ไว้ กด Train again เพื่อสร้าง run ใหม่"],
  WORKER_STORAGE_ERROR: ["Worker storage is unavailable. Check free disk space and directory permissions, then retry.", "Worker เตรียมพื้นที่เก็บงานไม่ได้ กรุณาตรวจสอบพื้นที่ดิสก์และสิทธิ์เข้าถึงโฟลเดอร์ แล้วลองใหม่"],
  COMPUTE_TIMEOUT: ["The job exceeded its time limit.", "งานใช้เวลาเกินขีดจำกัด"],
  GPU_UNAVAILABLE: ["The assigned GPU is no longer available. Retry after checking its load.", "GPU ที่จองไว้ไม่พร้อมแล้ว ตรวจสอบโหลดแล้วลองใหม่"],
  RESULT_EXPIRED: ["This result expired. Upload the image again.", "ผลทดสอบหมดอายุแล้ว กรุณาอัปโหลดภาพอีกครั้ง"],
  CONNECTION_INTERRUPTED: ["Connection interrupted. Retrying; your job continues on the server.", "การเชื่อมต่อสะดุด กำลังลองใหม่ งานยังทำต่อบนเซิร์ฟเวอร์"],
  SUBMISSION_UNCONFIRMED: ["Could not confirm submission. Retry with the same image to avoid creating a duplicate job.", "ยังยืนยันการส่งงานไม่ได้ กดลองใหม่ด้วยรูปเดิมเพื่อไม่สร้างงานซ้ำ"],
  queued: ["Queued", "รอในคิว"], dispatching: ["Starting", "กำลังส่งงาน"], running: ["Running", "กำลังทำงาน"],
  stopping: ["Stopping", "กำลังหยุด"], recovery_pending: ["Checking interrupted worker", "กำลังตรวจสอบ worker ที่ขาดการเชื่อมต่อ"],
  cancelled: ["Cancelled", "ยกเลิกแล้ว"], completed: ["Completed", "เสร็จแล้ว"], failed: ["Failed", "ไม่สำเร็จ"],
};
export function computeMessage(code: string | undefined, thai: boolean, fallback = "") {
  return (code && messages[code]?.[thai ? 1 : 0]) || fallback || code || "";
}
export const computeActive = (job: ComputeJob | null) => !!job && ["queued", "dispatching", "running", "stopping", "recovery_pending"].includes(job.status);
