import type { CVCatalog, ModelSpec, ParamSpec } from './cvCatalog';
import type { ConfigValue, TrainingConfig } from './trainingConfig';

const INTEGER_PARAMS = new Set(['epochs', 'batch_size', 'workers', 'seed', 'image_size', 'imgsz', 'max_size',
  'trainable_backbone_layers', 'detections_per_img', 'num_classes', 'ignore_index', 'encoder_depth', 'decoder_channels', 'patience']);

export function commonParameterValue(config: TrainingConfig, spec: ParamSpec): ConfigValue {
  const common: Record<string, ConfigValue> = { epochs: config.epochs, batch_size: config.batchSize,
    device: config.device, workers: config.workers, amp: config.amp, seed: config.seed };
  return common[spec.key] ?? config.params[spec.key] ?? spec.default;
}

export function parameterErrors(catalog: CVCatalog, model: ModelSpec, config: TrainingConfig,
  thai: boolean, lockedMaskClasses?: number, requiredMaskClasses?: number): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const spec of [...catalog.common_params, ...model.params]) {
    if (spec.key === 'device') continue;
    const value = lockedMaskClasses && spec.key === 'num_classes' ? lockedMaskClasses
      : lockedMaskClasses && spec.key === 'ignore_index' ? 255
      : catalog.common_params.includes(spec) ? commonParameterValue(config, spec) : config.params[spec.key] ?? spec.default;
    if (spec.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors[spec.key] = thai ? 'กรุณาระบุตัวเลข' : 'Enter a number.';
      } else if (INTEGER_PARAMS.has(spec.key) && !Number.isInteger(value)) {
        errors[spec.key] = thai ? 'กรุณาระบุจำนวนเต็ม' : 'Enter a whole number.';
      } else if ((spec.min !== undefined && value < spec.min) || (spec.max !== undefined && value > spec.max)) {
        errors[spec.key] = thai ? `ค่าต้องอยู่ระหว่าง ${spec.min ?? '−∞'} ถึง ${spec.max ?? '∞'}`
          : `Enter a value from ${spec.min ?? '−∞'} to ${spec.max ?? '∞'}.`;
      }
    } else if (spec.type === 'select' && !spec.options?.some(option => option.value === String(value))) {
      errors[spec.key] = thai ? 'กรุณาเลือกค่าที่รองรับ' : 'Choose an available option.';
    } else if (spec.key === 'decoder_atrous_rates' && !/^\s*[1-9]\d*\s*,\s*[1-9]\d*\s*,\s*[1-9]\d*\s*$/.test(String(value))) {
      errors[spec.key] = thai ? 'ระบุจำนวนเต็มบวก 3 ค่า คั่นด้วยเครื่องหมายจุลภาค' : 'Enter three positive whole numbers separated by commas.';
    }
  }
  if (model.id === 'deeplabv3plus' && requiredMaskClasses && !lockedMaskClasses && !errors.num_classes &&
      Number(config.params.num_classes ?? model.params.find(spec => spec.key === 'num_classes')?.default) < requiredMaskClasses) {
    errors.num_classes = thai ? `ต้องมีอย่างน้อย ${requiredMaskClasses} คลาส รวมพื้นหลัง` : `Use at least ${requiredMaskClasses} mask classes, including background.`;
  }
  if (['faster_rcnn', 'mask_rcnn'].includes(model.id)) {
    const short = Number(config.params.image_size ?? model.params.find(spec => spec.key === 'image_size')?.default);
    const long = Number(config.params.max_size ?? model.params.find(spec => spec.key === 'max_size')?.default);
    if (Number.isFinite(short) && Number.isFinite(long) && short > long && !errors.image_size && !errors.max_size) {
      errors.max_size = thai ? 'ด้านยาวต้องไม่น้อยกว่าด้านสั้น' : 'Long side cap must be at least the short side.';
    }
  }
  return errors;
}
