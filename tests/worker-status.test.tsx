import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ExecutionSelector } from '@/components/tasks/execution-selector';
import { TaskRun } from '@/components/tasks/task-run';
import { defaultConfig, type TrainingTask } from '@/lib/trainingConfig';
import { dictionary } from '@/lib/i18n';

const availability = vi.hoisted(() => ({ current: {
  status: 'ready' as 'ready' | 'error', cpuAvailable: false, coordinatorAvailable: false,
  devices: [{ uuid: 'gpu-1', name: 'GPU', status: 'offline', totalMb: 12000, freeMb: 11000, utilization: 0, temperature: 30, draining: false }],
} }));
vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ language: 'th', t: (key: string) => dictionary.th[key] ?? key }) }));
vi.mock('@/lib/use-compute-availability', () => ({ useComputeAvailability: () => availability.current }));
vi.mock('@/lib/api', () => ({ apiBaseUrl: () => '', artifactDownloadUrl: () => '' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/tasks/model-test-dialog', () => ({ ModelTestDialog: () => null }));
vi.mock('@/components/tasks/evaluation-panel', () => ({ EvaluationPanel: () => <div>Evaluation panel</div> }));
vi.mock('@/components/tasks/model-api-panel', () => ({ ModelApiPanel: () => <div>Model API panel</div> }));
vi.mock('@/components/workspace/metrics-charts', () => ({ MetricsCharts: () => null, formatMetricValue: () => '-' }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('device selector shows an offline status without changing the selected value', () => {
  const change = vi.fn();
  render(<ExecutionSelector value={{ mode: 'auto' }} onChange={change} />);
  expect(screen.getByRole('status').textContent).toContain('ยังไม่พร้อม');
  expect(change).not.toHaveBeenCalled();
});

test('queued task shows a clear explanation when the worker is offline', () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ logs: '' }))));
  const task: TrainingTask = { ...defaultConfig, id: 'task-1', displayName: 'Queued task', status: 'queued', jobId: null,
    computeJob: { id: 'job-1', kind: 'train', status: 'queued', requestedExecution: { mode: 'auto' } } };
  render(<TaskRun task={task} onRefresh={vi.fn(async () => {})} />);
  expect(screen.getByText(/งานยังอยู่ในคิวจนกว่าเครื่องจะพร้อม/)).toBeTruthy();
});

test('completed run keeps evaluation and API panels distinct after updates', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ logs: '', metrics: [] }))));
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const task: TrainingTask = { ...defaultConfig, id: 'task-1', displayName: 'Run', status: 'completed',
    runSlug: 'run-1', jobId: null };
  const view = render(<TaskRun task={task} onRefresh={vi.fn(async () => {})} />);
  view.rerender(<TaskRun task={{ ...task }} onRefresh={vi.fn(async () => {})} />);
  await waitFor(() => expect(screen.getAllByText('Evaluation panel')).toHaveLength(1));
  expect(screen.getAllByText('Model API panel')).toHaveLength(1);
  expect(consoleError.mock.calls.some(([message]) => String(message).includes('same key'))).toBe(false);
  consoleError.mockRestore();
});
