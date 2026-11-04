import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { TaskConfiguration } from '@/components/tasks/task-configuration';
import { catalogPlaceholder } from '@/lib/cvCatalog';
import { dictionary } from '@/lib/i18n';
import { defaultConfig } from '@/lib/trainingConfig';

const state = vi.hoisted(() => ({ language: 'en' as 'en' | 'th', availability: {
  status: 'ready' as 'ready' | 'error' | 'loading', cpuAvailable: true, coordinatorAvailable: true,
  devices: [{ uuid: 'gpu-1', name: 'GPU', status: 'ready', totalMb: 12000, freeMb: 11000, utilization: 0, temperature: 30, draining: false }],
} }));
vi.mock('@/components/language-provider', () => ({
  useLanguage: () => ({ t: (key: string) => dictionary[state.language][key] ?? key }),
}));
vi.mock('@/components/tasks/execution-selector', async () => {
  const React = await import('react');
  return { ExecutionSelector: ({ onAvailabilityChange }: { onAvailabilityChange?: (value: typeof state.availability) => void }) => {
    React.useEffect(() => { onAvailabilityChange?.(state.availability); }, [onAvailabilityChange]);
    return null;
  } };
});
vi.mock('@/lib/api', () => ({ apiBaseUrl: () => '' }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); state.language = 'en'; state.availability.status = 'ready'; state.availability.cpuAvailable = true; state.availability.coordinatorAvailable = true; state.availability.devices[0].status = 'ready'; });

test.each([
  { ok: true, label: 'Ready with warnings', disabled: false },
  { ok: false, label: 'Needs adjustment', disabled: true },
])('resource plan: $label', async ({ ok, label, disabled }) => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const result = url.endsWith('/api/model-catalog') ? catalogPlaceholder
      : url.endsWith('/api/datasets') ? { datasets: [] }
      : { ok, estimatedVramMb: 6200, safeLimitMb: 10440, isWithinLimit: true,
          batchSize: 2, warnings: ['VRAM is an estimate'], errors: ok ? [] : ['Invalid plan'], suggestions: [] };
    return new Response(JSON.stringify(result));
  }));
  const config = { ...defaultConfig, datasetName: 'qa-dataset' };
  const props = { config, onChange: vi.fn(), onSave: vi.fn(async () => {}), onTrain: vi.fn(), starting: false };
  const view = render(<TaskConfiguration {...props} saveState="saved" />);
  await screen.findByText(label);
  expect(screen.getByText('VRAM is an estimate')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Train' }) as HTMLButtonElement).disabled).toBe(disabled);
  if (ok) {
    view.rerender(<TaskConfiguration {...props} saveState="unsaved" />);
    expect(screen.getByText('Save the draft before training.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Train' }) as HTMLButtonElement).disabled).toBe(true);
  }
});

test('CPU explains system RAM without showing a GPU estimate', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(
    url.endsWith('/api/model-catalog') ? catalogPlaceholder
      : url.endsWith('/api/datasets') ? { datasets: [] }
      : { ok: true, device: 'CPU', estimatedVramMb: 6200, safeLimitMb: 10440, isWithinLimit: true,
          batchSize: 2, warnings: ['VRAM is an estimate, not a guarantee against out-of-memory errors.'], errors: [], suggestions: [] },
  ))));
  render(<TaskConfiguration config={{ ...defaultConfig, datasetName: 'qa', execution: { mode: 'cpu' } }} onChange={vi.fn()} onSave={vi.fn(async () => {})} onTrain={vi.fn()} starting={false} saveState="saved" />);
  await screen.findByText(/Training will use the CPU/);
  expect(screen.queryByText(/system estimates this run will use about/)).toBeNull();
  expect(screen.queryByText('VRAM is an estimate, not a guarantee against out-of-memory errors.')).toBeNull();
  expect((screen.getByRole('button', { name: 'Train' }) as HTMLButtonElement).disabled).toBe(false);
});

test('worker offline blocks training but a busy GPU can queue without changing the draft', async () => {
  state.availability.devices[0].status = 'offline';
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(
    url.endsWith('/api/model-catalog') ? catalogPlaceholder
      : url.endsWith('/api/datasets') ? { datasets: [] }
      : { ok: true, estimatedVramMb: 1, safeLimitMb: 2, isWithinLimit: true, batchSize: 2, warnings: [], errors: [], suggestions: [] },
  ))));
  const change = vi.fn();
  const props = { config: { ...defaultConfig, datasetName: 'qa' }, onChange: change, onSave: vi.fn(async () => {}), onTrain: vi.fn(), starting: false, saveState: 'saved' as const };
  const view = render(<TaskConfiguration {...props} />);
  await screen.findByText('The selected compute service is not ready. Try again later or contact an administrator.');
  expect((screen.getByRole('button', { name: 'Train' }) as HTMLButtonElement).disabled).toBe(true);
  expect(change).not.toHaveBeenCalled();
  view.unmount();
  state.availability.devices[0].status = 'busy';
  render(<TaskConfiguration {...props} />);
  await waitFor(() => expect((screen.getByRole('button', { name: 'Train' }) as HTMLButtonElement).disabled).toBe(false));
  expect(change).not.toHaveBeenCalled();
});

test('advanced model and worker parameters stay hidden until opened without changing values', async () => {
  const catalog = structuredClone(catalogPlaceholder);
  catalog.common_params = [{ key: 'epochs', label: 'Epochs', type: 'number', default: 10 }, { key: 'workers', label: 'Data workers', type: 'number', default: 2 }];
  catalog.tasks[0].models[0].params = [{ key: 'imgsz', label: 'Image size', type: 'number', default: 640 }, { key: 'decoder_atrous_rates', label: 'Atrous rates', type: 'text', default: '12,24,36' }];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(
    url.endsWith('/api/model-catalog') ? catalog : url.endsWith('/api/datasets') ? { datasets: [] }
      : { ok: true, estimatedVramMb: 1, safeLimitMb: 2, isWithinLimit: true, batchSize: 2, warnings: [], errors: [], suggestions: [] },
  ))));
  const change = vi.fn();
  const view = render(<TaskConfiguration config={{ ...defaultConfig, datasetName: 'qa' }} onChange={change} onSave={vi.fn(async () => {})} onTrain={vi.fn()} starting={false} saveState="saved" />);
  const summary = await screen.findByText('Advanced settings');
  const details = summary.closest('details')!;
  expect(details.open).toBe(false);
  expect(screen.getByLabelText('Epochs')).toBeTruthy();
  expect(screen.getByLabelText('Image size')).toBeTruthy();
  expect(details.querySelector('input[value="12,24,36"]')).toBeTruthy();
  fireEvent.click(summary);
  await waitFor(() => expect(details.open).toBe(true));
  expect(screen.getByText(/Comma-separated dilation rates/)).toBeTruthy();
  expect(change).not.toHaveBeenCalled();
  view.unmount();
});

test('Label Studio mask classes show dataset values and cannot be edited', async () => {
  const catalog = structuredClone(catalogPlaceholder);
  catalog.tasks[0].models[0].id = 'deeplabv3plus';
  catalog.tasks[0].models[0].params = [
    { key: 'num_classes', label: 'Mask classes', type: 'number', default: 2 },
    { key: 'ignore_index', label: 'Ignored mask value', type: 'number', default: 255 },
  ];
  const datasets = [{ id: 'data', name: 'labelled', images: 10, size: '1MB', formats: [], tasks: [], compatibleModels: [{ id: 'deeplabv3plus', ready: true }], labelSchema: { origin: 'label_studio', numClasses: 3 } }];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(
    url.endsWith('/api/model-catalog') ? catalog : url.endsWith('/api/datasets') ? { datasets }
      : { ok: true, estimatedVramMb: 1, safeLimitMb: 2, isWithinLimit: true, batchSize: 2, warnings: [], errors: [], suggestions: [] },
  ))));
  const change = vi.fn();
  render(<TaskConfiguration config={{ ...defaultConfig, modelType: 'deeplabv3plus', datasetName: 'labelled', params: { num_classes: 2, ignore_index: 1 } }} onChange={change} onSave={vi.fn(async () => {})} onTrain={vi.fn()} starting={false} saveState="saved" />);
  const summary = await screen.findByText('Advanced settings');
  fireEvent.click(summary);
  const classes = screen.getByLabelText('Mask classes') as HTMLInputElement;
  const ignored = screen.getByLabelText('Ignored mask value') as HTMLInputElement;
  expect(classes.value).toBe('3');
  expect(classes.disabled).toBe(true);
  expect(ignored.value).toBe('255');
  expect(ignored.disabled).toBe(true);
  expect(change).not.toHaveBeenCalled();
});

test('explains that a dataset is needed even when the memory plan is ready', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(
    url.endsWith('/api/model-catalog') ? catalogPlaceholder
      : url.endsWith('/api/datasets') ? { datasets: [] }
      : { ok: true, estimatedVramMb: 6200, safeLimitMb: 10440, isWithinLimit: true,
          batchSize: 2, warnings: ['VRAM is an estimate'], errors: [], suggestions: [] },
  ))));
  render(<TaskConfiguration config={defaultConfig} onChange={vi.fn()} onSave={vi.fn(async () => {})} onTrain={vi.fn()} starting={false} saveState="saved" />);
  await screen.findByText('Ready with warnings');
  expect(screen.getByText('Select a compatible dataset before training.')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Train' }) as HTMLButtonElement).disabled).toBe(true);
});

test.each([
  { language: 'en' as const, estimate: 'The system estimates this run will use about', note: 'VRAM is an estimate, not a guarantee against out-of-memory errors.' },
  { language: 'th' as const, estimate: 'ระบบประเมินว่าจะใช้หน่วยความจำ GPU', note: 'ค่า VRAM เป็นเพียงการประมาณ และไม่รับประกันว่าจะไม่เกิดปัญหาหน่วยความจำเต็ม' },
])('shows the VRAM note inside the estimate in $language', async ({ language, estimate, note }) => {
  state.language = language;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(
    url.endsWith('/api/model-catalog') ? catalogPlaceholder
      : url.endsWith('/api/datasets') ? { datasets: [] }
      : { ok: true, estimatedVramMb: 6200, safeLimitMb: 10440, isWithinLimit: true,
          batchSize: 2, warnings: ['VRAM is an estimate, not a guarantee against out-of-memory errors.'], errors: [], suggestions: [] },
  ))));
  render(<TaskConfiguration config={{ ...defaultConfig, datasetName: 'qa-dataset' }} onChange={vi.fn()} onSave={vi.fn(async () => {})} onTrain={vi.fn()} starting={false} saveState="saved" />);
  const noteElement = await screen.findByText(note);
  const estimateElement = screen.getByText((text) => text.startsWith(estimate));
  expect(estimateElement.parentElement?.contains(noteElement)).toBe(true);
  expect(screen.getAllByText(note)).toHaveLength(1);
  expect((screen.getByRole('button', { name: language === 'th' ? 'เริ่มฝึก' : 'Train' }) as HTMLButtonElement).disabled).toBe(false);
});
