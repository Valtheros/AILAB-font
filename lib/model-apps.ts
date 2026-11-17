import { apiBaseUrl } from "@/lib/api";
import { computeMessage, type ComputeJob } from "@/lib/compute";

export type AppRelease = { version: number; runSlug: string; testedAt: string | null; checkpointSha256: string; createdAt: string };
export type AppJob = ComputeJob & { version: number; appId: string | null; createdAt: string; startedAt: string | null; finishedAt: string | null };
export type ModelApp = {
  id: string; name: string; slug: string; description: string; path: string; published: boolean;
  activeVersion: number | null; version: number | null; taskType: string; modelType: string; isOwner: boolean;
  releases?: AppRelease[]; jobs?: AppJob[];
  usage?: { requests: number; completed: number; failed: number; pending: number; averageQueueSeconds: string | null };
};

const messages: Record<string, [string, string]> = {
  NOT_FOUND: ["This app or prediction is unavailable. It may be unpublished or removed.", "ไม่พบแอปหรือผลทำนาย อาจถูกปิดเผยแพร่หรือลบแล้ว"],
  APP_SLUG_EXISTS: ["This address is already used. Choose a different address.", "มีแอปใช้ที่อยู่นี้แล้ว กรุณาตั้งชื่อที่อยู่ใหม่"],
  APP_TEST_REQUIRED: ["Run a successful preview prediction before publishing this version.", "กรุณาทดสอบเวอร์ชันนี้ให้สำเร็จก่อนเผยแพร่"],
  APP_RELEASE_REQUIRED: ["Choose a version to preview first.", "กรุณาเลือกเวอร์ชันที่จะทดสอบก่อน"],
  APP_RELEASE_EXISTS: ["This run is already included in the app.", "มี run นี้ในแอปแล้ว"],
  APP_RELEASE_CHANGED: ["The app version changed. Refresh this page before trying again.", "เวอร์ชันแอปเปลี่ยนแล้ว กรุณารีเฟรชหน้าก่อนลองใหม่"],
  APP_TASK_MISMATCH: ["New versions must use the same task type.", "เวอร์ชันใหม่ต้องเป็นงานประเภทเดียวกับแอปเดิม"],
  APP_IN_USE: ["Unpublish the app and wait for its jobs to finish before deleting it.", "กรุณาปิดเผยแพร่และรอให้งานทำนายจบก่อนลบแอป"],
  MODEL_APP_IN_USE: ["This run is used by a Model App. Delete the app first.", "Model App ยังใช้ run นี้อยู่ กรุณาลบแอปก่อนลบโมเดล"],
  MODEL_APPS_UNAVAILABLE: ["Model Apps are temporarily unavailable. Contact an administrator.", "Model Apps ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล"],
  APP_LIMIT: ["This account has reached its app limit.", "จำนวนแอปถึงขีดจำกัดของบัญชีแล้ว"],
  APP_RELEASE_LIMIT: ["This app has reached its version limit.", "จำนวนเวอร์ชันของแอปถึงขีดจำกัดแล้ว"],
  APP_VISITOR_QUEUE_LIMIT: ["You already have three pending app predictions. Wait or cancel one.", "คุณมีงานทำนายผ่านแอปรออยู่ 3 งานแล้ว กรุณารอหรือยกเลิกบางงาน"],
  CHECKPOINT_CHANGED: ["The saved model changed or is unavailable. Ask the owner to publish a new version.", "โมเดลที่บันทึกไว้เปลี่ยนหรือไม่พร้อมใช้ กรุณาให้เจ้าของเผยแพร่เวอร์ชันใหม่"],
  CHECKPOINT_UNAVAILABLE: ["The saved model or its settings are unavailable.", "ไม่พบโมเดลหรือการตั้งค่าที่บันทึกไว้"],
  IMAGE_TOO_LARGE: ["Select an image no larger than 10 MiB.", "กรุณาเลือกรูปขนาดไม่เกิน 10 MiB"],
  RATE_LIMITED: ["Too many requests. Wait a minute and try again.", "ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่"],
  QUEUE_LIMIT: ["The model owner's queue is full. Try again after an existing job finishes.", "คิวของเจ้าของโมเดลเต็ม กรุณารอให้งานก่อนหน้าจบแล้วลองใหม่"],
  user_quota: ["Waiting for the model owner's earlier GPU jobs to finish.", "กำลังรอให้งาน GPU ก่อนหน้าของเจ้าของโมเดลเสร็จ"],
  STORAGE_QUOTA_EXCEEDED: ["The model owner's storage is full. Contact the app owner.", "พื้นที่ของเจ้าของโมเดลไม่พอ กรุณาติดต่อเจ้าของแอป"],
  COMPUTE_FAILED: ["Prediction failed. Retry, or contact the app owner if it happens again.", "ทำนายไม่สำเร็จ กรุณาลองใหม่ หากยังพบปัญหาให้ติดต่อเจ้าของแอป"],
  WORKER_INTERRUPTED: ["The prediction worker restarted. Submit the image again.", "เครื่องทำนายเริ่มใหม่ กรุณาส่งภาพอีกครั้ง"],
  OPERATION_FAILED: ["Could not complete the request. Please retry.", "ดำเนินการไม่สำเร็จ กรุณาลองใหม่"],
};

export function appMessage(code: string | undefined, thai: boolean) {
  return messages[code || ""]?.[thai ? 1 : 0] || computeMessage(code, thai, thai ? "ดำเนินการไม่สำเร็จ กรุณาลองใหม่" : "Could not complete the request. Please retry.");
}

export class AppRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function appRequest<T>(path: string, thai: boolean, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`${apiBaseUrl()}${path}`, { ...init, cache: "no-store" }); }
  catch (error) {
    if (init?.signal?.aborted) throw error;
    throw new AppRequestError(appMessage(init?.method === 'POST' ? 'SUBMISSION_UNCONFIRMED' : 'CONNECTION_INTERRUPTED', thai), 0);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = response.status === 413 ? appMessage("IMAGE_TOO_LARGE", thai) : appMessage(data?.code, thai);
    throw new AppRequestError(`${message}${data?.requestId ? ` (${data.requestId})` : ""}`, response.status);
  }
  return data;
}

export const appJSON = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
