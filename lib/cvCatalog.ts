export type ParamType = "number" | "boolean" | "select" | "text";

export interface ParamOption {
  value: string;
  label: string;
}

export interface ParamSpec {
  key: string;
  label: string;
  type: ParamType;
  default: number | boolean | string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: ParamOption[];
}

export interface OcrBaseModelPreset {
  id: string;
  value?: string;
  label: string;
  task?: "det" | "rec" | string;
  config_path?: string;
  pretrained_model?: string;
  labels?: string[];
  description?: string;
  available?: boolean;
}

export interface ResourceProfileMetadata {
  target_gpu_vram_mb?: number;
  safe_gpu_vram_mb?: number;
  target_system_ram_gb?: number;
  safe_system_ram_gb?: number;
  policy?: string;
}

export interface ModelSpec {
  id: string;
  label: string;
  model_name: string;
  runtime: string;
  reason: string;
  dataset_formats: string[];
  params: ParamSpec[];
  dataset_task?: string;
  required_annotations?: string[];
  accepted_source_formats?: string[];
  accepted_canonical_formats?: string[];
  canonical_format?: string;
  conversion_targets?: string[];
  train_export_format?: string;
  base_model_presets?: OcrBaseModelPreset[];
  resource_profile?: ResourceProfileMetadata;
  safe_defaults?: Record<string, number | string | boolean>;
  hard_limits?: Record<string, number | string | boolean>;
  memory_notes?: string[];
}

export interface TaskSpec {
  id: string;
  label: string;
  description: string;
  dataset_formats: string[];
  models: ModelSpec[];
}

export interface CVCatalog {
  version: string;
  common_params: ParamSpec[];
  tasks: TaskSpec[];
}

const numberParam = (
  key: string,
  label: string,
  value: number,
  min?: number,
  max?: number,
  step?: number,
): ParamSpec => ({ key, label, type: "number", default: value, min, max, step });

const boolParam = (key: string, label: string, value: boolean): ParamSpec => ({
  key,
  label,
  type: "boolean",
  default: value,
});

const selectParam = (
  key: string,
  label: string,
  value: string,
  options: ParamOption[],
): ParamSpec => ({ key, label, type: "select", default: value, options });

const textParam = (key: string, label: string, value = ""): ParamSpec => ({
  key,
  label,
  type: "text",
  default: value,
});

const optimizerParams: ParamSpec[] = [
  selectParam("optimizer", "Optimizer", "sgd", [
    { value: "sgd", label: "SGD" },
    { value: "adam", label: "Adam" },
    { value: "adamw", label: "AdamW" },
    { value: "rmsprop", label: "RMSprop" },
  ]),
  numberParam("learning_rate", "Learning rate", 0.001, 0.000001, 1, 0.0001),
  numberParam("momentum", "Momentum", 0.9, 0, 0.999, 0.001),
  numberParam("weight_decay", "Weight decay", 0.0005, 0, 0.1, 0.0001),
  selectParam("scheduler", "LR scheduler", "cosine", [
    { value: "none", label: "None" },
    { value: "step", label: "StepLR" },
    { value: "cosine", label: "Cosine" },
  ]),
];

const classificationBase: ParamSpec[] = [
  numberParam("image_size", "Image size", 224, 64, 1024, 1),
  boolParam("pretrained", "ImageNet weights", true),
  boolParam("freeze_backbone", "Freeze backbone", false),
  numberParam("dropout", "Classifier dropout", 0.2, 0, 0.8, 0.05),
  numberParam("label_smoothing", "Label smoothing", 0, 0, 0.5, 0.01),
  numberParam("random_rotation", "Random rotation", 0, 0, 180, 1),
  numberParam("horizontal_flip", "Horizontal flip", 0.5, 0, 1, 0.05),
  numberParam("color_jitter", "Color jitter", 0.1, 0, 1, 0.05),
  ...optimizerParams,
];

const detectionParams: ParamSpec[] = [
  boolParam("pretrained", "COCO weights", true),
  numberParam("image_size", "Short side", 640, 256, 1600, 32),
  numberParam("max_size", "Long side cap", 1333, 512, 2400, 32),
  numberParam("trainable_backbone_layers", "Trainable backbone layers", 3, 0, 5, 1),
  numberParam("rpn_nms_thresh", "RPN NMS threshold", 0.7, 0.1, 1, 0.05),
  numberParam("box_score_thresh", "Box score threshold", 0.05, 0, 1, 0.01),
  numberParam("box_nms_thresh", "Box NMS threshold", 0.5, 0.1, 1, 0.05),
  numberParam("detections_per_img", "Detections per image", 100, 1, 1000, 1),
  ...optimizerParams,
];

const paddleOcrBaseModelPresets: OcrBaseModelPreset[] = [
  {
    id: "ppocrv4-rec",
    label: "PP-OCRv4 Recognition",
    task: "rec",
    config_path: "/opt/PaddleOCR/configs/rec/PP-OCRv4/ch_PP-OCRv4_rec.yml",
    pretrained_model: "",
    labels: ["rec_gt_train.txt", "rec_gt_val.txt"],
    description: "General text recognition using the selected PaddleOCR config default weights.",
    available: true,
  },
  {
    id: "ppocrv4-det",
    label: "PP-OCRv4 Detection",
    task: "det",
    config_path: "/opt/PaddleOCR/configs/det/ch_PP-OCRv4/ch_PP-OCRv4_det.yml",
    pretrained_model: "",
    labels: ["det_gt_train.txt", "det_gt_val.txt"],
    description: "General text detection using the selected PaddleOCR config default weights.",
    available: true,
  },
];

const tesseractBaseModelPresets: OcrBaseModelPreset[] = [
  {
    id: "eng",
    value: "eng",
    label: "English (eng)",
    description: "Bundled with the OCR worker image.",
    available: true,
  },
  {
    id: "tha",
    value: "tha",
    label: "Thai (tha)",
    description: "Bundled with the OCR worker image after rebuild.",
    available: true,
  },
];

export const fallbackCatalog: CVCatalog = {
  version: "local-fallback",
  common_params: [
    numberParam("epochs", "Epochs", 50, 1, 2000, 1),
    numberParam("batch_size", "Batch size", 16, 1, 256, 1),
    selectParam("device", "Device", "cpu", [
      { value: "cpu", label: "CPU" },
    ]),
    numberParam("workers", "Workers", 4, 0, 32, 1),
    boolParam("amp", "Mixed precision", true),
    numberParam("seed", "Seed", 0, 0, 999999, 1),
  ],
  tasks: [
    {
      id: "image_classification",
      label: "Image Classification",
      description: "Fine-tune classifiers from ImageFolder datasets.",
      dataset_formats: ["imagefolder"],
      models: [
        {
          id: "resnet",
          label: "ResNet",
          model_name: "resnet50",
          runtime: "PyTorch / TorchVision",
          reason: "Reliable baseline with pretrained TorchVision weights.",
          dataset_formats: ["imagefolder"],
          params: [
            selectParam("architecture", "Architecture", "resnet50", [
              { value: "resnet18", label: "ResNet-18" },
              { value: "resnet34", label: "ResNet-34" },
              { value: "resnet50", label: "ResNet-50" },
              { value: "resnet101", label: "ResNet-101" },
            ]),
            ...classificationBase,
          ],
        },
        {
          id: "efficientnet",
          label: "EfficientNet",
          model_name: "efficientnet_b0",
          runtime: "PyTorch / TorchVision",
          reason: "Compact, popular classifiers with good accuracy per parameter.",
          dataset_formats: ["imagefolder"],
          params: [
            selectParam("architecture", "Architecture", "efficientnet_b0", [
              { value: "efficientnet_b0", label: "EfficientNet-B0" },
              { value: "efficientnet_b1", label: "EfficientNet-B1" },
              { value: "efficientnet_b2", label: "EfficientNet-B2" },
              { value: "efficientnet_b3", label: "EfficientNet-B3" },
            ]),
            ...classificationBase,
          ],
        },
      ],
    },
    {
      id: "segmentation",
      label: "Semantic / Instance Segmentation",
      description: "Semantic masks with DeepLabV3+ or COCO instance masks with Mask R-CNN.",
      dataset_formats: ["semantic_masks", "coco_instances"],
      models: [
        {
          id: "deeplabv3plus",
          label: "DeepLabV3+",
          model_name: "deeplabv3plus",
          runtime: "PyTorch / segmentation-models-pytorch",
          reason: "Strong semantic segmentation model with flexible encoders.",
          dataset_formats: ["semantic_masks"],
          params: [
            selectParam("encoder_name", "Encoder", "resnet34", [
              { value: "resnet18", label: "ResNet-18" },
              { value: "resnet34", label: "ResNet-34" },
              { value: "resnet50", label: "ResNet-50" },
              { value: "efficientnet-b0", label: "EfficientNet-B0" },
              { value: "mobilenet_v2", label: "MobileNetV2" },
            ]),
            selectParam("encoder_weights", "Encoder weights", "imagenet", [
              { value: "imagenet", label: "ImageNet" },
              { value: "none", label: "Random init" },
            ]),
            numberParam("image_size", "Image size", 512, 128, 2048, 32),
            numberParam("num_classes", "Mask classes", 2, 1, 1000, 1),
            numberParam("ignore_index", "Ignored mask value", 255, -1, 255, 1),
            numberParam("encoder_depth", "Encoder depth", 5, 3, 5, 1),
            selectParam("encoder_output_stride", "Output stride", "16", [
              { value: "8", label: "8" },
              { value: "16", label: "16" },
            ]),
            numberParam("decoder_channels", "Decoder channels", 256, 32, 1024, 32),
            textParam("decoder_atrous_rates", "Atrous rates", "12,24,36"),
            selectParam("loss", "Loss", "cross_entropy", [
              { value: "cross_entropy", label: "Cross entropy" },
              { value: "dice", label: "Dice" },
            ]),
            ...optimizerParams,
          ],
        },
        {
          id: "mask_rcnn",
          label: "Mask R-CNN",
          model_name: "maskrcnn_resnet50_fpn_v2",
          runtime: "PyTorch / TorchVision",
          reason: "TorchVision instance segmentation model with COCO pretrained weights.",
          dataset_formats: ["coco_instances"],
          params: detectionParams,
        },
      ],
    },
    {
      id: "ocr",
      label: "OCR / Document Vision",
      description: "OCR training wrappers for PaddleOCR and Tesseract.",
      dataset_formats: ["paddleocr_labels", "tesseract_ground_truth"],
      models: [
        {
          id: "paddleocr",
          label: "PaddleOCR",
          model_name: "paddleocr",
          runtime: "PaddlePaddle / PaddleOCR",
          reason: "Official Docker-oriented OCR training stack.",
          dataset_formats: ["paddleocr_labels"],
          base_model_presets: paddleOcrBaseModelPresets,
          params: [
            textParam("config_path", "Config path", "/opt/PaddleOCR/configs/rec/PP-OCRv4/ch_PP-OCRv4_rec.yml"),
            textParam("pretrained_model", "Pretrained model"),
            numberParam("batch_size_per_card", "Batch per card", 32, 1, 512, 1),
            selectParam("ocr_task", "OCR task", "rec", [
              { value: "det", label: "Detection" },
              { value: "rec", label: "Recognition" },
            ]),
            numberParam("learning_rate", "Learning rate", 0.001, 0.000001, 1, 0.0001),
            textParam("character_dict_path", "Character dictionary"),
            boolParam("use_space_char", "Use space char", true),
            numberParam("max_text_length", "Max text length", 25, 1, 512, 1),
          ],
        },
        {
          id: "tesseract",
          label: "Tesseract",
          model_name: "tesseract_lstm",
          runtime: "Tesseract / tesstrain",
          reason: "Official training workflow for language and font adaptation.",
          dataset_formats: ["tesseract_ground_truth"],
          base_model_presets: tesseractBaseModelPresets,
          params: [
            textParam("model_name", "Output model code", "custom"),
            textParam("start_model", "Start model", "eng"),
            numberParam("max_iterations", "Max iterations", 10000, 100, 1000000, 100),
            numberParam("target_error_rate", "Target CER", 0.01, 0.0001, 1, 0.001),
            numberParam("ratio_train", "Train split ratio", 0.9, 0.1, 0.99, 0.01),
          ],
        },
      ],
    },
    {
      id: "object_detection",
      label: "Object Detection",
      description: "YOLO plus Faster R-CNN for bounding-box detection.",
      dataset_formats: ["yolo_detection", "coco_instances"],
      models: [
        {
          id: "yolo",
          label: "YOLOv11",
          model_name: "yolo11n",
          runtime: "PyTorch / Ultralytics",
          reason: "Existing fast detector in this platform.",
          dataset_formats: ["yolo_detection"],
          params: [
            selectParam("model_size", "Model size", "n", [
              { value: "n", label: "Nano" },
              { value: "s", label: "Small" },
              { value: "m", label: "Medium" },
              { value: "l", label: "Large" },
              { value: "x", label: "XLarge" },
            ]),
            numberParam("imgsz", "Image size", 640, 64, 2048, 32),
            selectParam("optimizer", "Optimizer", "auto", [
              { value: "auto", label: "Auto" },
              { value: "SGD", label: "SGD" },
              { value: "Adam", label: "Adam" },
              { value: "AdamW", label: "AdamW" },
            ]),
            numberParam("lr0", "Initial LR", 0.01, 0.000001, 1, 0.0001),
            numberParam("lrf", "Final LR factor", 0.01, 0, 1, 0.001),
            numberParam("momentum", "Momentum", 0.937, 0, 0.999, 0.001),
            numberParam("weight_decay", "Weight decay", 0.0005, 0, 0.1, 0.0001),
            numberParam("patience", "Patience", 100, 0, 1000, 1),
            boolParam("pretrained", "Pretrained weights", true),
            boolParam("cache", "Cache images", false),
            numberParam("degrees", "Rotation", 0, 0, 180, 1),
            numberParam("translate", "Translate", 0.1, 0, 1, 0.01),
            numberParam("scale", "Scale", 0.5, 0, 1, 0.01),
            numberParam("fliplr", "Horizontal flip", 0.5, 0, 1, 0.05),
            numberParam("mosaic", "Mosaic", 1, 0, 1, 0.05),
            numberParam("mixup", "MixUp", 0, 0, 1, 0.05),
          ],
        },
        {
          id: "faster_rcnn",
          label: "Faster R-CNN",
          model_name: "fasterrcnn_resnet50_fpn_v2",
          runtime: "PyTorch / TorchVision",
          reason: "Popular two-stage detector with TorchVision pretrained weights.",
          dataset_formats: ["yolo_detection", "coco_instances"],
          params: detectionParams,
        },
      ],
    },
  ],
};

export function getTask(catalog: CVCatalog, taskId: string) {
  return catalog.tasks.find((task) => task.id === taskId) ?? catalog.tasks[0];
}

export function getModel(catalog: CVCatalog, taskId: string, modelId: string) {
  const task = getTask(catalog, taskId);
  return task.models.find((model) => model.id === modelId) ?? task.models[0];
}

export function defaultParamsFor(model: ModelSpec, commonParams: ParamSpec[]) {
  return [...commonParams, ...model.params].reduce<Record<string, number | boolean | string>>(
    (acc, spec) => {
      acc[spec.key] = spec.default;
      return acc;
    },
    {},
  );
}
