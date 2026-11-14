export function memoryMessage(message: string, thai: boolean): string {
  if (!thai) return message;
  const patterns: [RegExp, (...groups: string[]) => string][] = [
    [/^Data workers reduced from (\d+) to (\d+) for the available system RAM\.$/, (a, b) => `ลดจำนวน data workers จาก ${a} เป็น ${b} ตาม RAM ที่มี`],
    [/^(\S+) image_size (\d+) exceeds the safe 1024 cap to prevent memory errors\.$/, (model, size) => `${model} ขนาดภาพ ${size} เกินขีดจำกัดปลอดภัย 1024`],
    [/^(\S+) batch_size (\d+) is too high for image_size (\d+)\.$/, (model, batch, size) => `${model} batch size ${batch} สูงเกินไปสำหรับขนาดภาพ ${size}`],
    [/^YOLOv11 imgsz (\d+) exceeds the safe 1024 cap to prevent memory errors\.$/, size => `YOLOv11 ขนาดภาพ ${size} เกินขีดจำกัดปลอดภัย 1024`],
    [/^YOLOv11(\w+) imgsz (\d+) batch_size (\d+) exceeds the safe limit\.$/, (size, image, batch) => `YOLOv11${size} ขนาดภาพ ${image} และ batch size ${batch} เกินขีดจำกัดปลอดภัย`],
    [/^(\S+) max_size (\d+) exceeds the safe 1600 long-side cap\.$/, (model, size) => `${model} ด้านยาว ${size} เกินขีดจำกัดปลอดภัย 1600`],
    [/^DeepLabV3\+ image_size (\d+) with batch_size (\d+) exceeds the safe limit\.$/, (size, batch) => `DeepLabV3+ ขนาดภาพ ${size} และ batch size ${batch} เกินขีดจำกัดปลอดภัย`],
    [/^Estimated GPU memory (\d+) MB exceeds the safe (\d+) MB limit\.$/, (used, limit) => `หน่วยความจำ GPU ที่ประมาณ ${used} MB เกินขีดจำกัดปลอดภัย ${limit} MB`],
    [/^Use batch_size <= (\d+)\.$/, cap => `ใช้ batch size ไม่เกิน ${cap}`],
    [/^Use batch_size <= (\d+); batch 1-2 is recommended\.$/, cap => `ใช้ batch size ไม่เกิน ${cap} โดยแนะนำ 1–2`],
    [/^Use batch_size <= (\d+) for YOLOv11(\w+) at imgsz (\d+)\.$/, (cap, model, size) => `ใช้ batch size ไม่เกิน ${cap} สำหรับ YOLOv11${model} ที่ขนาดภาพ ${size}`],
  ];
  for (const [pattern, translate] of patterns) {
    const match = message.match(pattern);
    if (match) return translate(...match.slice(1));
  }
  const fixed: Record<string, string> = {
    'Use image_size 224-512, or batch 1-4 for larger images.': 'ใช้ขนาดภาพ 224–512 หรือ batch size 1–4 สำหรับภาพที่ใหญ่กว่า',
    'Use imgsz 640 for normal training, or 1024 with a much smaller batch.': 'ใช้ขนาดภาพ 640 สำหรับการฝึกทั่วไป หรือ 1024 พร้อมลด batch size',
    'Use image_size 640-1024.': 'ใช้ขนาดภาพ 640–1024',
    'Use max_size <= 1600.': 'ใช้ด้านยาวไม่เกิน 1600',
    'Use image_size 512 batch_size 2, or image_size 1024 batch_size 1.': 'ใช้ขนาดภาพ 512 กับ batch size 2 หรือขนาดภาพ 1024 กับ batch size 1',
    'Reduce batch size or image size until the estimated GPU memory fits the safe limit.': 'ลด batch size หรือขนาดภาพจนหน่วยความจำ GPU ที่ประมาณอยู่ในขีดจำกัดปลอดภัย',
    'YOLO image cache was disabled because safe caching can cause memory errors on this machine.': 'ปิด image cache ของ YOLO เพื่อลดความเสี่ยงหน่วยความจำเต็ม',
  };
  return fixed[message] ?? message;
}
