import type { ModelSpec, ParamSpec } from "./cvCatalog";

type Copy = readonly [en: string, th: string];
export interface ParameterHelp {
  title: Copy;
  summary: Copy;
  effect: Copy;
  start?: Copy;
  caution?: Copy;
}

export const helpText = (copy: Copy, language: "en" | "th") => copy[language === "th" ? 1 : 0];
export const defaultStart: Copy = [
  "Start with the model's default shown here. Change one setting at a time and compare validation results on the same dataset.",
  "เริ่มจากค่าเริ่มต้นของโมเดลที่แสดงไว้ ปรับทีละค่าแล้วเทียบผล validation บนชุดข้อมูลเดียวกัน",
];

const help: Record<string, ParameterHelp> = {
  epochs: {
    title: ["Training rounds (Epochs)", "จำนวนรอบฝึก (Epochs)"],
    summary: ["How many times the model can learn from the training set.", "จำนวนรอบที่โมเดลจะเรียนรู้จากชุด train"],
    effect: ["More rounds take longer and can help learning; too many can overfit. Fewer rounds finish sooner but may stop before learning enough.", "เพิ่มรอบใช้เวลานานขึ้นและอาจช่วยให้เรียนรู้มากขึ้น แต่ฝึกมากไปอาจจำเฉพาะชุด train ลดรอบเสร็จเร็วขึ้นแต่อาจยังเรียนรู้ไม่พอ"],
    caution: ["More rounds do not guarantee better validation results. YOLO may stop early when patience is reached.", "รอบมากขึ้นไม่ได้รับประกันผล validation ที่ดีขึ้น YOLO อาจหยุดก่อนครบเมื่อถึงเงื่อนไข patience"],
  },
  batch_size: {
    title: ["Images per step (Batch size)", "ภาพต่อขั้นการฝึก (Batch size)"],
    summary: ["The number of images processed together in one training step.", "จำนวนภาพที่ใช้ฝึกพร้อมกันในแต่ละขั้น"],
    effect: ["A larger batch may use the GPU more efficiently but needs more memory. A smaller batch reduces memory use and changes how frequently weights are updated.", "เพิ่มค่าอาจทำให้ใช้ GPU ได้เต็มขึ้น แต่ใช้หน่วยความจำมากขึ้น ลดค่าช่วยประหยัดหน่วยความจำและเปลี่ยนความถี่ในการปรับน้ำหนักโมเดล"],
    caution: ["Reduce this first if GPU memory runs out. Larger batches are not automatically more accurate.", "หากหน่วยความจำ GPU ไม่พอให้ลองลดค่านี้ก่อน Batch ใหญ่ไม่ได้แปลว่าแม่นยำกว่าเสมอ"],
  },
  device: {
    title: ["Training processor (Device)", "อุปกรณ์ที่ใช้ฝึก (Device)"],
    summary: ["Select the CPU or an available GPU for this run.", "เลือก CPU หรือ GPU ที่มีอยู่สำหรับงานนี้"],
    effect: ["GPU is usually faster for these models. CPU uses system RAM and generally takes longer. Each listed GPU has its own memory capacity.", "GPU มักฝึกโมเดลเหล่านี้ได้เร็วกว่า CPU ใช้ RAM ของเครื่องและมักใช้เวลานานกว่า GPU แต่ละใบมีความจุหน่วยความจำของตัวเอง"],
    caution: ["Selecting a GPU does not reserve its memory; other running work can still affect availability.", "การเลือก GPU ไม่ได้จองหน่วยความจำ งานอื่นที่กำลังทำงานอาจส่งผลต่อพื้นที่ว่าง"],
  },
  workers: {
    title: ["Image loading processes (Data workers)", "ตัวช่วยโหลดภาพ (Data workers)"],
    summary: ["CPU processes that prepare images while the model trains.", "จำนวน process ฝั่ง CPU ที่ช่วยเตรียมภาพระหว่างฝึก"],
    effect: ["More workers can reduce loading waits but use more CPU and RAM. Zero loads images in the main training process.", "เพิ่มค่าอาจลดเวลารอโหลดภาพ แต่ใช้ CPU และ RAM เพิ่ม ค่า 0 โหลดภาพใน process หลักของการฝึก"],
    caution: ["Too many workers can slow the server down. This is not the number of GPUs or simultaneous training jobs.", "มากเกินไปอาจทำให้เครื่องช้าลง ค่านี้ไม่ใช่จำนวน GPU หรือจำนวนงานฝึกพร้อมกัน"],
  },
  amp: {
    title: ["Memory-saving math (Mixed precision)", "การคำนวณแบบประหยัดหน่วยความจำ (Mixed precision)"],
    summary: ["Use mixed numeric precision when training on a supported CUDA GPU.", "ใช้ความละเอียดตัวเลขแบบผสมเมื่อฝึกบน CUDA GPU ที่รองรับ"],
    effect: ["On can reduce GPU memory use and speed up training. Off uses standard precision and may need more memory.", "เปิดอาจลดการใช้หน่วยความจำ GPU และช่วยให้ฝึกเร็วขึ้น ปิดใช้ความละเอียดปกติและอาจใช้หน่วยความจำมากกว่า"],
    caution: ["It does not enable GPU acceleration on CPU. If training becomes numerically unstable, compare a run with it off.", "ไม่ได้ทำให้ CPU กลายเป็น GPU หากค่าระหว่างฝึกไม่เสถียร ให้ลองเปรียบเทียบกับการปิดตัวเลือกนี้"],
  },
  seed: {
    title: ["Randomness starting point (Seed)", "ค่าเริ่มต้นการสุ่ม (Seed)"],
    summary: ["Controls the starting point for random choices such as shuffling images.", "กำหนดจุดเริ่มต้นของการสุ่ม เช่น การสลับลำดับภาพ"],
    effect: ["Keep the same seed when comparing settings. Changing it changes random choices; a larger number is not better.", "ใช้ค่าเดิมเมื่อต้องการเปรียบเทียบการตั้งค่า เปลี่ยนค่าแล้วลำดับการสุ่มจะเปลี่ยน เลขมากกว่าไม่ได้ดีกว่า"],
    caution: ["The same seed does not guarantee identical results across different hardware or software versions.", "Seed เดียวกันไม่ได้รับประกันผลเหมือนกันทุกครั้งเมื่อเปลี่ยนฮาร์ดแวร์หรือเวอร์ชันซอฟต์แวร์"],
  },
  optimizer: {
    title: ["Learning method (Optimizer)", "วิธีปรับน้ำหนักโมเดล (Optimizer)"],
    summary: ["The method used to update the model from its mistakes.", "วิธีที่โมเดลใช้ปรับตัวจากข้อผิดพลาด"],
    effect: ["SGD follows the gradient with momentum. Adam adapts updates for each weight. AdamW separates weight decay from those updates. RMSprop adapts updates using recent gradient sizes.", "SGD ปรับตามทิศทางความผิดพลาดร่วมกับ momentum ส่วน Adam ปรับขนาดการเรียนรู้แยกตามน้ำหนัก AdamW แยกการลดทอนน้ำหนักออกจากขั้นนั้น และ RMSprop ใช้ขนาดความผิดพลาดช่วงล่าสุดช่วยปรับ"],
    caution: ["Changing optimizer can require a different learning rate. No option is best for every dataset.", "เปลี่ยน optimizer อาจต้องปรับ learning rate ด้วย ไม่มีตัวเลือกที่ดีที่สุดสำหรับทุกชุดข้อมูล"],
  },
  learning_rate: {
    title: ["Learning step size (Learning rate)", "ขนาดก้าวการเรียนรู้ (Learning rate)"],
    summary: ["Controls how strongly each training step changes model weights.", "กำหนดว่าแต่ละขั้นจะปรับน้ำหนักโมเดลมากน้อยแค่ไหน"],
    effect: ["Higher values make larger updates but can make loss fluctuate or diverge. Lower values make smaller updates and may learn more slowly.", "เพิ่มค่าแล้วปรับตัวแรงขึ้น แต่ loss อาจแกว่งหรือแย่ลง ลดค่าแล้วปรับทีละน้อยและอาจเรียนรู้ช้าลง"],
  },
  momentum: {
    title: ["Update carry-over (Momentum)", "แรงต่อเนื่องในการปรับน้ำหนัก (Momentum)"],
    summary: ["Carries part of previous updates into the next learning step.", "นำทิศทางการปรับครั้งก่อนมาช่วยในการปรับครั้งถัดไป"],
    effect: ["Higher values keep more of the previous direction; lower values react more to the current step. Too much can overshoot a useful solution.", "เพิ่มค่าแล้วรักษาทิศทางเดิมมากขึ้น ลดค่าแล้วตอบสนองต่อขั้นปัจจุบันมากขึ้น มากเกินไปอาจปรับเลยจุดที่เหมาะสม"],
    caution: ["In these PyTorch trainers it affects SGD and RMSprop, not Adam or AdamW.", "ใน trainer ของ PyTorch นี้มีผลกับ SGD และ RMSprop ไม่ได้ใช้กับ Adam หรือ AdamW"],
  },
  weight_decay: {
    title: ["Weight regularization (Weight decay)", "การลดทอนน้ำหนัก (Weight decay)"],
    summary: ["Discourages overly large weights to help limit overfitting.", "ลดแนวโน้มที่น้ำหนักโมเดลจะใหญ่เกินไป เพื่อช่วยลดการจำชุด train มากเกินไป"],
    effect: ["Increasing it strengthens regularization but too much can prevent learning. Reducing it relaxes regularization. Zero disables this penalty.", "เพิ่มค่าแล้วควบคุมน้ำหนักมากขึ้น แต่สูงไปอาจเรียนรู้ไม่พอ ลดค่าแล้วควบคุมน้อยลง ค่า 0 ปิดการลดทอนนี้"],
  },
  scheduler: {
    title: ["Learning rate schedule (LR scheduler)", "แผนปรับอัตราการเรียนรู้ (LR scheduler)"],
    summary: ["Controls how the learning rate changes during training.", "กำหนดว่า learning rate จะเปลี่ยนอย่างไรระหว่างฝึก"],
    effect: ["None keeps it fixed. StepLR reduces it to one tenth roughly every third of the run. Cosine annealing reduces it smoothly over the planned epochs.", "None ใช้ค่าเดิม StepLR ลดเหลือหนึ่งในสิบประมาณทุกหนึ่งในสามของงาน ส่วน Cosine annealing ค่อย ๆ ลดตามจำนวนรอบที่ตั้งไว้"],
  },
  architecture: {
    title: ["Model variant (Architecture)", "รุ่นย่อยของโมเดล (Architecture)"],
    summary: ["Choose a variant within the selected model family.", "เลือกรุ่นย่อยในตระกูลโมเดลที่เลือก"],
    effect: ["Larger variants generally take more memory and time, with more capacity to learn complex patterns. Smaller variants are cheaper to train and run.", "รุ่นใหญ่โดยทั่วไปใช้หน่วยความจำและเวลามากขึ้น และเรียนรู้รูปแบบซับซ้อนได้มากขึ้น รุ่นเล็กใช้ทรัพยากรน้อยกว่าทั้งตอนฝึกและใช้งาน"],
    caution: ["A larger architecture does not guarantee better results, especially with little training data.", "รุ่นใหญ่ไม่ได้รับประกันผลที่ดีกว่า โดยเฉพาะเมื่อข้อมูลฝึกมีน้อย"],
  },
  image_size: {
    title: ["Image resolution (Image size)", "ความละเอียดภาพ (Image size)"],
    summary: ["The square image size, in pixels, used by this trainer.", "ขนาดภาพสี่เหลี่ยมจัตุรัส หน่วยพิกเซล ที่ trainer นี้ใช้"],
    effect: ["Larger images preserve more detail but need more memory and computation. Smaller images train faster but can lose small details.", "เพิ่มขนาดช่วยคงรายละเอียดมากขึ้น แต่ใช้หน่วยความจำและการคำนวณเพิ่ม ลดขนาดฝึกเร็วขึ้นแต่อาจเสียรายละเอียดเล็ก ๆ"],
    caution: ["Upscaling cannot recover detail that is missing from the source image.", "การขยายภาพไม่ได้สร้างรายละเอียดจริงที่ไม่มีในภาพต้นฉบับ"],
  },
  pretrained: {
    title: ["Start from learned weights (Pretrained weights)", "เริ่มจากน้ำหนักที่ฝึกไว้แล้ว (Pretrained weights)"],
    summary: ["Start from weights learned on another dataset instead of starting from scratch.", "เริ่มจากน้ำหนักที่เคยฝึกกับข้อมูลอื่น แทนการเริ่มใหม่ทั้งหมด"],
    effect: ["On often helps learning with limited data. Off requests random initialization where supported and usually needs more data and training.", "เปิดมักช่วยเมื่อข้อมูลมีจำกัด ปิดเป็นการขอเริ่มจากการสุ่มในส่วนที่รองรับ ซึ่งมักต้องใช้ข้อมูลและการฝึกมากขึ้น"],
    caution: ["The source and behavior depend on the selected model. The first use may download weights.", "แหล่งน้ำหนักและพฤติกรรมขึ้นกับโมเดลที่เลือก การใช้ครั้งแรกอาจต้องดาวน์โหลดน้ำหนัก"],
  },
  freeze_backbone: {
    title: ["Keep feature extractor fixed (Freeze backbone)", "คงตัวสกัดลักษณะภาพไว้ (Freeze backbone)"],
    summary: ["Train only the classification head instead of updating backbone weights too.", "ฝึกเฉพาะส่วนตัดสินคลาส แทนการปรับน้ำหนักส่วนสกัดลักษณะภาพด้วย"],
    effect: ["On reduces trainable weights and can save memory. Off lets the model adapt its features to your images but needs more resources.", "เปิดลดจำนวนค่าที่ต้องฝึกและอาจประหยัดหน่วยความจำ ปิดให้โมเดลปรับลักษณะภาพให้ตรงกับข้อมูลคุณ แต่ใช้ทรัพยากรมากกว่า"],
    caution: ["Freezing a randomly initialized backbone usually leaves poor features. Prefer pretrained weights when freezing.", "การล็อกส่วนสกัดลักษณะที่ยังเป็นค่าสุ่มมักได้ลักษณะภาพที่ไม่ดี ควรใช้คู่กับน้ำหนักที่ฝึกไว้แล้ว"],
  },
  dropout: {
    title: ["Training dropout (Classifier dropout)", "การพักหน่วยคำนวณระหว่างฝึก (Classifier dropout)"],
    summary: ["Randomly drops a fraction of classifier activations during training.", "สุ่มพักการทำงานบางส่วนในตัวจำแนกคลาสระหว่างฝึก"],
    effect: ["Higher values add regularization; too much can make learning harder. Zero disables dropout. It is inactive when predicting.", "เพิ่มค่าแล้วควบคุมการจำข้อมูลมากขึ้น แต่สูงไปอาจเรียนรู้ยาก ค่า 0 ปิด dropout และไม่ใช้การสุ่มนี้ตอนทำนาย"],
  },
  label_smoothing: {
    title: ["Softer training targets (Label smoothing)", "ลดความสุดโต่งของคำตอบฝึก (Label smoothing)"],
    summary: ["Softens the target probabilities rather than treating the correct class as completely certain.", "ปรับคำตอบเป้าหมายไม่ให้มั่นใจในคลาสที่ถูกต้องแบบสุดโต่ง"],
    effect: ["Higher values discourage overconfidence but can blur useful class distinctions. Zero uses the original hard targets.", "เพิ่มค่าช่วยลดความมั่นใจเกินไป แต่สูงไปอาจทำให้แยกคลาสได้ไม่ชัด ค่า 0 ใช้คำตอบเป้าหมายปกติ"],
  },
  random_rotation: {
    title: ["Random rotation (Degrees)", "การหมุนภาพแบบสุ่ม (Degrees)"],
    summary: ["Maximum rotation angle in either direction for training images.", "มุมหมุนภาพสูงสุดในแต่ละทิศทางสำหรับภาพฝึก"],
    effect: ["Higher values produce a wider range of rotations. Zero keeps the original orientation. The stored source images are unchanged.", "เพิ่มค่าแล้วสุ่มหมุนได้กว้างขึ้น ค่า 0 ไม่หมุน ภาพต้นฉบับที่เก็บไว้ไม่ถูกเปลี่ยน"],
    caution: ["Use only rotations that could occur in real use; orientation can change the meaning of some classes.", "ควรหมุนเฉพาะแบบที่มีโอกาสเกิดตอนใช้งานจริง เพราะบางคลาสเปลี่ยนความหมายเมื่อหมุน"],
  },
  horizontal_flip: {
    title: ["Left-right flip probability", "โอกาสกลับภาพซ้ายขวา (Horizontal flip)"],
    summary: ["Probability of mirroring a training image from left to right.", "โอกาสสุ่มกลับภาพฝึกแบบซ้ายขวา"],
    effect: ["0 never flips, 0.5 flips about half the time, and 1 always flips. Larger values mean more frequent flips, not stronger flips.", "0 ไม่กลับภาพ 0.5 กลับประมาณครึ่งหนึ่ง และ 1 กลับทุกครั้ง ค่ามากขึ้นคือกลับบ่อยขึ้น ไม่ใช่กลับแรงขึ้น"],
    caution: ["Avoid it when left/right direction or readable text matters to the label.", "หลีกเลี่ยงเมื่อซ้ายขวามีความหมายต่อคลาส หรือภาพมีข้อความที่ต้องอ่านตามทิศเดิม"],
  },
  color_jitter: {
    title: ["Lighting and color variation (Color jitter)", "ความแปรผันแสงและสี (Color jitter)"],
    summary: ["Randomly changes brightness, contrast and saturation during training.", "สุ่มปรับความสว่าง ความเปรียบต่าง และความอิ่มสีระหว่างฝึก"],
    effect: ["Increasing it creates stronger variation; zero disables it. It can help with lighting changes but may remove important color cues.", "เพิ่มค่าแล้วภาพเปลี่ยนมากขึ้น ค่า 0 ปิด อาจช่วยรับมือแสงที่เปลี่ยน แต่แรงไปอาจทำลายสีที่สำคัญต่อการจำแนก"],
  },
  max_size: {
    title: ["Maximum long edge (Long side cap)", "เพดานด้านยาวของภาพ (Long side cap)"],
    summary: ["Limits the long edge when resizing detection or instance images.", "จำกัดด้านยาวขณะปรับขนาดภาพ detection หรือ instance"],
    effect: ["A larger cap keeps more detail in wide or tall images but uses more memory. A smaller cap may also shrink the short edge below its target.", "เพิ่มเพดานช่วยเก็บรายละเอียดภาพกว้างหรือสูง แต่ใช้หน่วยความจำเพิ่ม ลดเพดานอาจทำให้ด้านสั้นเล็กกว่าค่าที่ตั้งไว้ด้วย"],
  },
  trainable_backbone_layers: {
    title: ["Backbone stages to fine-tune", "จำนวนช่วงของ backbone ที่ฝึกเพิ่ม"],
    summary: ["How many backbone stages can adapt when fine-tuning pretrained detection weights.", "จำนวนช่วงในส่วนสกัดลักษณะที่ปรับเพิ่มได้ เมื่อใช้โมเดลตรวจจับที่ฝึกไว้แล้ว"],
    effect: ["More stages give more flexibility but need more memory and can overfit small datasets. Fewer stages keep more existing features fixed.", "เพิ่มจำนวนแล้วปรับตัวได้มากขึ้น แต่ใช้หน่วยความจำมากขึ้นและอาจจำข้อมูลชุดเล็กมากไป ลดจำนวนแล้วคงลักษณะเดิมไว้มากขึ้น"],
    caution: ["TorchVision can override the freeze setting when no pretrained weights are used.", "TorchVision อาจเปลี่ยนการล็อกชั้นเมื่อไม่ได้ใช้น้ำหนักที่ฝึกไว้แล้ว"],
  },
  rpn_nms_thresh: {
    title: ["Proposal overlap threshold (RPN NMS)", "เกณฑ์กล่องเสนอที่ซ้อนกัน (RPN NMS)"],
    summary: ["Controls removal of overlapping candidate boxes before final classification.", "ควบคุมการตัดกล่องเสนอที่ซ้อนกัน ก่อนขั้นตัดสินคลาสสุดท้าย"],
    effect: ["Lower values suppress overlapping proposals more aggressively. Higher values retain more overlaps and can increase processing work.", "ลดค่าแล้วตัดกล่องซ้อนกันมากขึ้น เพิ่มค่าแล้วเก็บกล่องซ้อนไว้มากขึ้นและอาจเพิ่มงานคำนวณ"],
  },
  box_score_thresh: {
    title: ["Minimum detection score", "คะแนนขั้นต่ำของผลตรวจจับ (Box score threshold)"],
    summary: ["Filters predicted boxes by their confidence score.", "กรองกล่องที่โมเดลทำนายตามคะแนนความมั่นใจ"],
    effect: ["Higher values show fewer low-confidence boxes but may miss objects. Lower values retain more boxes, including more false detections.", "เพิ่มค่าแล้วเก็บกล่องที่ไม่มั่นใจน้อยลง แต่อาจพลาดวัตถุ ลดค่าแล้วเก็บมากขึ้นรวมถึงผลตรวจผิด"],
    caution: ["This filters predictions, including evaluation outputs; it is not a learning rate or a guarantee of accuracy.", "เป็นเกณฑ์กรองผลทำนาย รวมถึงผลประเมิน ไม่ใช่อัตราการเรียนรู้หรือการรับประกันความแม่นยำ"],
  },
  box_nms_thresh: {
    title: ["Final box overlap threshold (NMS)", "เกณฑ์กล่องผลลัพธ์ที่ซ้อนกัน (NMS)"],
    summary: ["Removes lower-scoring overlapping predictions for the same class.", "ตัดกล่องทำนายคลาสเดียวกันที่ซ้อนและมีคะแนนต่ำกว่า"],
    effect: ["Lower values remove more overlaps but can miss nearby objects. Higher values retain more overlaps and may show duplicate boxes.", "ลดค่าแล้วตัดกล่องซ้อนมากขึ้น แต่อาจพลาดวัตถุที่อยู่ติดกัน เพิ่มค่าแล้วเก็บกล่องซ้อนมากขึ้นและอาจมีกล่องซ้ำ"],
  },
  detections_per_img: {
    title: ["Maximum detections per image", "จำนวนผลตรวจจับสูงสุดต่อภาพ"],
    summary: ["Caps the number of final detections kept for each image.", "จำกัดจำนวนผลตรวจจับสุดท้ายที่เก็บไว้ในแต่ละภาพ"],
    effect: ["Raise it for crowded scenes, at a cost in output size and processing. Lower it to keep fewer detections; objects beyond the cap are omitted.", "เพิ่มเมื่อภาพมีวัตถุหนาแน่น แต่ผลลัพธ์และงานประมวลผลจะเพิ่ม ลดแล้วเก็บผลน้อยลง วัตถุที่เกินเพดานจะไม่ถูกส่งออก"],
  },
  encoder_name: {
    title: ["Feature extractor (Encoder)", "ตัวสกัดลักษณะภาพ (Encoder)"],
    summary: ["Selects the backbone used by DeepLabV3+ to understand images.", "เลือก backbone ที่ DeepLabV3+ ใช้ทำความเข้าใจภาพ"],
    effect: ["ResNet variants differ in depth. EfficientNet-B0 and MobileNetV2 emphasize efficiency. Larger encoders can need more memory and time without guaranteeing better masks.", "รุ่น ResNet ต่างกันที่ความลึก ส่วน EfficientNet-B0 และ MobileNetV2 เน้นความคุ้มค่าการคำนวณ Encoder ใหญ่อาจใช้เวลาและหน่วยความจำมากขึ้น โดยไม่ได้รับประกัน mask ที่ดีกว่า"],
  },
  encoder_weights: {
    title: ["Encoder starting weights", "น้ำหนักเริ่มต้นของ Encoder"],
    summary: ["ImageNet starts with learned visual features; Random init starts without them.", "ImageNet เริ่มจากลักษณะภาพที่เรียนรู้ไว้ ส่วน Random init เริ่มจากค่าสุ่ม"],
    effect: ["ImageNet often helps when training data is limited. Random initialization generally needs more data and learning time.", "ImageNet มักช่วยเมื่อข้อมูลฝึกมีจำกัด การเริ่มสุ่มมักต้องใช้ข้อมูลและเวลาฝึกมากกว่า"],
    caution: ["ImageNet weights may need to be downloaded on first use.", "การใช้ครั้งแรกอาจต้องดาวน์โหลดน้ำหนัก ImageNet"],
  },
  num_classes: {
    title: ["Number of mask classes", "จำนวนคลาสใน mask (Mask classes)"],
    summary: ["The number of pixel classes the model can predict, including background when present.", "จำนวนคลาสของพิกเซลที่โมเดลทำนายได้ รวม background หากมี"],
    effect: ["It must match the mask encoding, not desired accuracy. With consecutive IDs starting at zero, it is the largest class ID plus one.", "ต้องตรงกับรหัสใน mask ไม่ใช่ปรับเพื่อเพิ่มความแม่นยำ หากรหัสต่อเนื่องเริ่มที่ 0 จำนวนนี้คือรหัสคลาสสูงสุดบวกหนึ่ง"],
    start: ["Use the dataset's class mapping. AILAB semantic datasets set this automatically and include background.", "ใช้ตามการจับคู่คลาสของ dataset สำหรับ semantic dataset จาก AILAB ระบบกำหนดให้อัตโนมัติรวม background"],
    caution: ["An incorrect count can fail training or create unused output classes.", "จำนวนไม่ตรงอาจทำให้ฝึกไม่สำเร็จหรือมีคลาสผลลัพธ์ที่ไม่ถูกใช้งาน"],
  },
  ignore_index: {
    title: ["Pixel ID excluded from learning", "รหัสพิกเซลที่ไม่ใช้ฝึก (Ignored mask value)"],
    summary: ["Pixels with this exact mask value are ignored by loss and metric calculations.", "พิกเซลที่มีรหัสตรงกับค่านี้จะไม่ถูกใช้คำนวณ loss และ metrics"],
    effect: ["This selects an ID, not a strength. Changing it excludes a different value. -1 ignores no ordinary non-negative PNG mask value.", "เป็นการเลือกรหัส ไม่ใช่ระดับความแรง เปลี่ยนค่าแล้วจะละเว้นรหัสอื่น ค่า -1 ไม่ตรงกับรหัสพิกเซลปกติที่ไม่ติดลบใน PNG"],
    start: ["Match the dataset's void/unlabeled pixel ID. If none exists, ensure this value does not equal a real class or background.", "ตั้งตามรหัสพิกเซลที่ dataset ระบุว่าไม่ต้องใช้ หากไม่มี ต้องแน่ใจว่าค่านี้ไม่ตรงกับคลาสจริงหรือ background"],
    caution: ["Using a real class ID here silently removes that class's pixels from learning and evaluation.", "หากใช้รหัสคลาสจริง พิกเซลคลาสนั้นจะถูกตัดออกจากการฝึกและประเมิน"],
  },
  encoder_depth: {
    title: ["Encoder depth", "ความลึกของ Encoder"],
    summary: ["Number of encoder stages used to extract image features.", "จำนวนช่วงของ encoder ที่ใช้สกัดลักษณะภาพ"],
    effect: ["Deeper settings use more feature stages and can cost more memory. Shallower settings reduce stages but may not match every encoder/decoder combination.", "เพิ่มความลึกแล้วใช้ลักษณะภาพหลายช่วงขึ้นและอาจใช้หน่วยความจำเพิ่ม ลดแล้วใช้ช่วงน้อยลง แต่อาจไม่เข้ากับ encoder/decoder ทุกคู่"],
    caution: ["This is an advanced architecture setting; keep the default unless you have checked compatibility.", "เป็นค่าขั้นสูงของโครงสร้างโมเดล ควรคงค่าเดิมหากยังไม่ได้ตรวจความเข้ากันได้"],
  },
  encoder_output_stride: {
    title: ["Feature resolution (Output stride)", "ความละเอียดลักษณะภาพ (Output stride)"],
    summary: ["How far encoder features are downsampled relative to the input image.", "อัตราการย่อแผนที่ลักษณะภาพจากภาพต้นฉบับ"],
    effect: ["8 keeps finer features and usually needs more memory and computation. 16 is coarser and generally cheaper.", "8 เก็บลักษณะภาพละเอียดกว่าและมักใช้หน่วยความจำกับการคำนวณมากกว่า ส่วน 16 หยาบกว่าและมักใช้ทรัพยากรน้อยกว่า"],
  },
  decoder_channels: {
    title: ["Decoder width (Channels)", "ความกว้างของ Decoder (Channels)"],
    summary: ["Number of feature channels used to reconstruct segmentation predictions.", "จำนวนช่องลักษณะภาพที่ใช้สร้างผล segmentation"],
    effect: ["More channels increase capacity and memory use. Fewer channels are lighter but may limit what the decoder can represent.", "เพิ่มช่องแล้วรองรับรูปแบบได้มากขึ้นและใช้หน่วยความจำเพิ่ม ลดช่องแล้วเบาขึ้นแต่อาจจำกัดความสามารถของ decoder"],
  },
  decoder_atrous_rates: {
    title: ["Feature sampling spacing (Atrous rates)", "ระยะการเก็บลักษณะภาพ (Atrous rates)"],
    summary: ["Comma-separated dilation rates for the decoder, for example 12,24,36.", "ระยะ dilation ของ decoder เป็นเลขคั่นด้วยจุลภาค เช่น 12,24,36"],
    effect: ["Larger rates sample a wider area with more spacing; smaller rates focus more locally. This changes context, not image resolution.", "เลขมากเก็บบริบทกว้างขึ้นแต่เว้นระยะมากขึ้น เลขน้อยเน้นบริเวณใกล้กว่า เป็นการเปลี่ยนบริบท ไม่ใช่ความละเอียดภาพ"],
    start: ["Keep the three default rates unless you are deliberately changing the decoder and output stride together.", "คงเลขสามค่าตั้งต้นไว้ เว้นแต่ต้องการปรับ decoder ร่วมกับ output stride โดยเฉพาะ"],
  },
  loss: {
    title: ["Training objective (Loss)", "เกณฑ์วัดข้อผิดพลาดเพื่อฝึก (Loss)"],
    summary: ["The objective DeepLabV3+ minimizes while learning masks.", "เกณฑ์ที่ DeepLabV3+ พยายามลดขณะเรียนรู้ mask"],
    effect: ["Cross entropy evaluates pixel class probabilities. Dice emphasizes overlap of predicted and target regions and can help with class imbalance.", "Cross entropy ประเมินความน่าจะเป็นคลาสของพิกเซล ส่วน Dice เน้นพื้นที่ซ้อนกันระหว่างผลทำนายกับคำตอบ และอาจช่วยเมื่อสัดส่วนคลาสไม่เท่ากัน"],
    caution: ["Loss values from different objectives are not directly comparable; compare validation IoU/Dice instead.", "ค่าตัวเลข loss คนละแบบเทียบกันตรง ๆ ไม่ได้ ควรเทียบ validation IoU/Dice แทน"],
  },
  model_size: {
    title: ["YOLO model size", "ขนาดโมเดล YOLO"],
    summary: ["Nano, Small, Medium, Large and XLarge are increasingly large YOLO variants.", "Nano, Small, Medium, Large และ XLarge คือรุ่น YOLO ที่ใหญ่ขึ้นตามลำดับ"],
    effect: ["Larger variants usually need more GPU memory and time. Nano/Small are lighter for both training and prediction; larger variants may capture more complex patterns.", "รุ่นใหญ่มักใช้หน่วยความจำ GPU และเวลามากขึ้น Nano/Small เบากว่าทั้งตอนฝึกและทำนาย รุ่นใหญ่อาจเรียนรู้รูปแบบซับซ้อนได้มากกว่า"],
    caution: ["Check the memory estimate after changing size. More capacity does not guarantee better accuracy.", "ตรวจค่าประมาณหน่วยความจำหลังเปลี่ยนขนาด ความจุมากขึ้นไม่ได้รับประกันความแม่นยำ"],
  },
  lrf: {
    title: ["Final learning rate multiplier", "ตัวคูณอัตราการเรียนรู้ช่วงท้าย (Final LR factor)"],
    summary: ["A multiplier used by YOLO's learning rate schedule, not an absolute learning rate.", "ตัวคูณที่ YOLO ใช้ในแผนปรับ learning rate ไม่ใช่ค่า learning rate โดยตรง"],
    effect: ["The schedule targets initial learning rate multiplied by this factor at its end. Lower values reduce the final rate more; 1 keeps the same target rate.", "ช่วงท้ายของแผนมีเป้าหมายเป็น learning rate เริ่มต้นคูณค่านี้ ค่าน้อยลดช่วงท้ายมากกว่า ค่า 1 มีเป้าหมายเท่าค่าเริ่มต้น"],
  },
  patience: {
    title: ["Wait before early stopping (Patience)", "รอก่อนหยุดฝึกอัตโนมัติ (Patience)"],
    summary: ["YOLO's allowed epochs without improvement in its validation fitness before stopping.", "จำนวนรอบที่ YOLO รอเมื่อคะแนน fitness จาก validation ไม่ดีขึ้น ก่อนหยุดฝึก"],
    effect: ["Higher values wait longer; lower values stop sooner. Zero disables this early-stop limit in YOLO.", "เพิ่มค่าแล้วรอนานขึ้น ลดค่าแล้วหยุดไวขึ้น ค่า 0 ปิดขีดจำกัด early stop นี้ใน YOLO"],
    caution: ["Stopping uses YOLO's validation fitness, not just the displayed training loss.", "การหยุดอ้างอิงคะแนน fitness ของ YOLO จาก validation ไม่ใช่แค่ training loss ที่แสดง"],
  },
  cache: {
    title: ["Keep images in RAM (Cache images)", "เก็บภาพไว้ใน RAM (Cache images)"],
    summary: ["Asks YOLO to cache training images in system memory.", "ให้ YOLO เก็บภาพฝึกไว้ใน RAM ของเครื่อง"],
    effect: ["On can reduce disk reads if enough RAM is available. Off reads without this RAM cache and uses less system memory.", "เปิดอาจลดการอ่านจากดิสก์หาก RAM เพียงพอ ปิดไม่ใช้ RAM cache นี้และใช้หน่วยความจำเครื่องน้อยกว่า"],
    caution: ["Large datasets can consume substantial RAM. This is system RAM, not GPU VRAM; YOLO may skip caching if RAM is insufficient.", "ข้อมูลใหญ่ใช้ RAM มาก นี่คือ RAM ของเครื่องไม่ใช่ VRAM ของ GPU และ YOLO อาจไม่สร้าง cache หาก RAM ไม่พอ"],
  },
  translate: {
    title: ["Random image shifting (Translate)", "การเลื่อนภาพแบบสุ่ม (Translate)"],
    summary: ["Maximum random shift as a fraction of image dimensions during YOLO training.", "ระยะเลื่อนภาพแบบสุ่มสูงสุด เป็นสัดส่วนของขนาดภาพระหว่างฝึก YOLO"],
    effect: ["Higher values shift objects farther from their original position. Zero disables shifting. Large shifts can move objects outside the image.", "เพิ่มค่าแล้ววัตถุเลื่อนจากตำแหน่งเดิมได้ไกลขึ้น ค่า 0 ไม่เลื่อน เลื่อนมากอาจทำให้วัตถุหลุดขอบภาพ"],
  },
  scale: {
    title: ["Random zoom range (Scale)", "ช่วงการซูมแบบสุ่ม (Scale)"],
    summary: ["Variation around the original scale during YOLO augmentation.", "ความแปรผันจากขนาดเดิมระหว่างสร้างภาพฝึก YOLO"],
    effect: ["Higher values create a wider range of zooms; zero disables this variation. Strong zooms can crop objects or make them very small.", "เพิ่มค่าแล้วสุ่มย่อขยายได้กว้างขึ้น ค่า 0 ไม่สุ่มส่วนนี้ ซูมแรงอาจตัดวัตถุหรือทำให้เล็กมาก"],
  },
  mosaic: {
    title: ["Combine training scenes (Mosaic)", "ผสมฉากภาพฝึก (Mosaic)"],
    summary: ["Probability of combining multiple images into one YOLO training image.", "โอกาสนำหลายภาพมาประกอบเป็นภาพฝึก YOLO ภาพเดียว"],
    effect: ["Higher values apply mosaic more often, exposing objects to varied contexts. Zero disables it. YOLO may turn it off near the end of training.", "เพิ่มค่าแล้วใช้ mosaic บ่อยขึ้น ทำให้วัตถุอยู่ในบริบทหลากหลาย ค่า 0 ปิด และ YOLO อาจปิดช่วงท้ายของการฝึก"],
    caution: ["Artificial scenes may differ from real use; compare validation results rather than assuming more augmentation is better.", "ฉากที่สร้างอาจต่างจากการใช้งานจริง ควรเทียบ validation ไม่ใช่ถือว่าเพิ่มภาพดัดแปลงแล้วดีกว่าเสมอ"],
  },
  mixup: {
    title: ["Blend training images (MixUp)", "ซ้อนผสมภาพฝึก (MixUp)"],
    summary: ["Probability of blending two YOLO training images and their labels.", "โอกาสซ้อนผสมภาพฝึก YOLO สองภาพพร้อม label"],
    effect: ["Higher values blend images more often, not more strongly. Zero disables MixUp. Blending can regularize learning but makes scenes less natural.", "เพิ่มค่าแล้วผสมภาพบ่อยขึ้น ไม่ใช่ผสมแรงขึ้น ค่า 0 ปิด MixUp การผสมอาจช่วยลดการจำข้อมูลแต่ทำให้ฉากไม่เหมือนจริง"],
  },
  project_name: {
    title: ["Run name (Project name)", "ชื่องานฝึก (Project name)"],
    summary: ["A name for identifying this training run and its results.", "ชื่อสำหรับแยกแยะงานฝึกและผลลัพธ์ของงานนี้"],
    effect: ["Use a short descriptive name such as road_trial_01. Renaming does not change how the model learns.", "ใช้ชื่อสั้นที่สื่อความหมาย เช่น road_trial_01 การเปลี่ยนชื่อไม่ได้เปลี่ยนวิธีเรียนรู้ของโมเดล"],
    start: ["Name runs so that you can recognize them later in Tasks and compare results.", "ตั้งชื่อให้จำได้เมื่อกลับมาดูใน Tasks หรือเปรียบเทียบผล"],
  },
  task: {
    title: ["Prediction task", "งานที่ต้องการให้โมเดลทำนาย (Task)"],
    summary: ["Choose the kind of answer you need from an image.", "เลือกรูปแบบคำตอบที่ต้องการจากภาพ"],
    effect: ["Classification assigns an image class. Detection finds bounding boxes. Segmentation finds object pixels: DeepLabV3+ predicts pixel classes; Mask R-CNN separates instances.", "Classification จำแนกคลาสของภาพ Detection หาวัตถุเป็นกล่อง Segmentation หาพื้นที่พิกเซล โดย DeepLabV3+ จำแนกคลาสพิกเซล ส่วน Mask R-CNN แยกวัตถุเป็นรายชิ้น"],
    start: ["Choose the output your application needs before choosing a model.", "เลือกจากคำตอบที่ต้องการนำไปใช้ก่อนเลือกโมเดล"],
    caution: ["Changing task resets model settings and clears the selected dataset.", "การเปลี่ยน Task จะตั้งค่าของโมเดลใหม่และล้าง dataset ที่เลือกไว้"],
  },
  model: {
    title: ["Training model", "โมเดลสำหรับฝึก (Model)"],
    summary: ["Choose a model that produces the selected task's output.", "เลือกโมเดลที่ให้ผลลัพธ์ตรงกับ Task"],
    effect: ["ResNet/EfficientNet classify images. YOLO/Faster R-CNN detect boxes. DeepLabV3+ produces semantic masks; Mask R-CNN produces separate object masks.", "ResNet/EfficientNet จำแนกภาพ YOLO/Faster R-CNN ตรวจจับกล่อง DeepLabV3+ สร้าง semantic mask ส่วน Mask R-CNN สร้าง mask แยกแต่ละวัตถุ"],
    start: ["Compare models on the same dataset and consider memory use and prediction speed as well as accuracy.", "เทียบโมเดลบน dataset เดียวกัน และพิจารณาหน่วยความจำกับความเร็วทำนายร่วมกับความแม่นยำ"],
    caution: ["Changing model resets its parameters and clears the selected dataset.", "เปลี่ยนโมเดลแล้วระบบจะตั้งค่าพารามิเตอร์ใหม่และล้าง dataset ที่เลือกไว้"],
  },
  dataset: {
    title: ["Training data (Dataset)", "ชุดข้อมูลสำหรับฝึก (Dataset)"],
    summary: ["Select the labeled images the model will learn from.", "เลือกภาพพร้อม label ที่จะใช้สอนโมเดล"],
    effect: ["Train teaches the model, validation helps assess it during training, and test evaluates held-out images. Only compatible datasets are listed.", "Train ใช้สอนโมเดล validation ช่วยประเมินระหว่างฝึก ส่วน test ใช้ประเมินภาพที่กันไว้ รายการแสดงเฉพาะ dataset ที่เข้ากันได้"],
    start: ["Use representative images with consistent labels and keep near-duplicate images out of different splits.", "ใช้ภาพที่ใกล้กับงานจริงและ label สม่ำเสมอ หลีกเลี่ยงภาพซ้ำหรือเกือบซ้ำข้าม split"],
  },
  memory: {
    title: ["Memory Safety", "การตรวจหน่วยความจำ (Memory Safety)"],
    summary: ["Checks settings and estimates GPU memory before training.", "ตรวจการตั้งค่าและประมาณหน่วยความจำ GPU ก่อนฝึก"],
    effect: ["Batch size, image resolution and model size can increase memory use. Data workers and caching also affect system RAM.", "Batch size ความละเอียดภาพ และขนาดโมเดลอาจเพิ่มการใช้หน่วยความจำ Data workers และ cache ยังใช้ RAM ของเครื่องด้วย"],
    start: ["If settings exceed the safety limits, review the warnings or apply the listed safe settings.", "หากค่าเกินขีดจำกัด ให้ตรวจคำเตือนหรือใช้ชุดค่าปลอดภัยที่แสดง"],
    caution: ["The estimate is not a reservation or a guarantee against out-of-memory errors. Other jobs, image shapes and runtime overhead can change actual usage.", "เป็นค่าประมาณ ไม่ใช่การจองหรือรับประกันว่าจะไม่เกิดหน่วยความจำเต็ม งานอื่น รูปร่างภาพ และค่าใช้จ่ายขณะรันอาจทำให้ใช้จริงต่างออกไป"],
  },
};

help.lr0 = { ...help.learning_rate, title: ["Initial learning rate", "อัตราการเรียนรู้เริ่มต้น (Initial LR)"], caution: ["YOLO Auto optimizer can choose its own learning rate instead of lr0.", "เมื่อใช้ Auto optimizer YOLO อาจเลือก learning rate เองแทน lr0"] };
help.degrees = help.random_rotation;
help.fliplr = help.horizontal_flip;
help.imgsz = { ...help.image_size, summary: ["YOLO's target input size in pixels, with resizing and padding as needed.", "ขนาดภาพเป้าหมายของ YOLO หน่วยพิกเซล โดยปรับขนาดและเติมขอบตามที่จำเป็น"] };

const detectorSize: ParameterHelp = {
  ...help.image_size,
  title: ["Target short edge (Short side)", "ด้านสั้นเป้าหมาย (Short side)"],
  summary: ["Resizes the shorter edge while preserving aspect ratio, limited by Long side cap.", "ปรับด้านสั้นโดยรักษาอัตราส่วนภาพ และไม่ให้ด้านยาวเกิน Long side cap"],
};

export function parameterHelp(key: string, modelId?: string): ParameterHelp | undefined {
  const base = help[key];
  if (!base) return undefined;
  if (key === "image_size" && ["faster_rcnn", "mask_rcnn"].includes(modelId ?? "")) return detectorSize;
  if (key === "pretrained" && ["resnet", "efficientnet"].includes(modelId ?? "")) return {
    ...base, summary: ["On starts the classifier backbone from ImageNet weights; off starts from random weights.", "เปิดเริ่ม backbone จากน้ำหนัก ImageNet ปิดเริ่มจากน้ำหนักสุ่ม"],
  };
  if (key === "pretrained" && ["faster_rcnn", "mask_rcnn"].includes(modelId ?? "")) return {
    ...base, summary: ["On loads COCO detection weights before replacing the prediction head for your classes.", "เปิดโหลดน้ำหนักตรวจจับ COCO ก่อนเปลี่ยนส่วนทำนายให้ตรงกับคลาสของคุณ"],
    caution: ["Off skips full COCO weights, but TorchVision may still initialize the backbone with ImageNet weights. It is not necessarily a fully random model.", "ปิดไม่โหลดน้ำหนัก COCO ทั้งโมเดล แต่ TorchVision อาจยังเริ่ม backbone จาก ImageNet จึงไม่จำเป็นต้องเป็นโมเดลสุ่มทั้งหมด"],
  };
  if (key === "pretrained" && modelId === "yolo") return {
    ...base, caution: ["AILAB currently loads a .pt checkpoint before passing this flag to YOLO. Off does not guarantee training from scratch in this pipeline.", "ตอนนี้ AILAB โหลด checkpoint .pt ก่อนส่งค่านี้ให้ YOLO การปิดจึงไม่ได้รับประกันว่า pipeline นี้เริ่มฝึกจากค่าสุ่ม"],
  };
  if (key === "optimizer" && modelId === "yolo") return {
    ...base, effect: ["Auto lets YOLO choose the optimizer and some learning settings. SGD uses momentum; Adam adapts each weight's updates; AdamW also decouples weight decay.", "Auto ให้ YOLO เลือก optimizer และค่าการเรียนรู้บางส่วน SGD ใช้ momentum ส่วน Adam ปรับการเรียนรู้แยกตามน้ำหนัก และ AdamW แยกการลดทอนน้ำหนัก"],
    caution: ["With Auto, manually entered initial learning rate and momentum may be overridden.", "เมื่อใช้ Auto ค่า initial learning rate และ momentum ที่กรอกเองอาจถูกแทนที่"],
  };
  if (key === "momentum" && modelId === "yolo") return {
    ...base, caution: ["YOLO uses this for SGD momentum or Adam-family beta1. Auto optimizer may replace the entered value.", "YOLO ใช้เป็น momentum ของ SGD หรือ beta1 ของตระกูล Adam และ Auto optimizer อาจแทนค่าที่กรอก"],
  };
  return base;
}

export function displayParameterValue(value: unknown, spec: ParamSpec | undefined, language: "en" | "th"): string {
  if (typeof value === "boolean") return language === "th" ? (value ? "เปิด" : "ปิด") : (value ? "On" : "Off");
  return spec?.options?.find((option) => option.value === String(value))?.label ?? String(value ?? "");
}

export function missingParameterHelp(catalog: { common_params: ParamSpec[]; tasks: { models: ModelSpec[] }[] }): string[] {
  return catalog.tasks.flatMap((task) => task.models.flatMap((model) =>
    [...catalog.common_params, ...model.params].filter((spec) => !parameterHelp(spec.key, model.id)).map((spec) => `${model.id}.${spec.key}`),
  ));
}
