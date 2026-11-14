import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import { CompareRunsDialog } from '@/components/tasks/compare-runs-dialog';

vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock('@/lib/api', () => ({ apiBaseUrl: () => '' }));
vi.mock('recharts', () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { ResponsiveContainer: Container, LineChart: Container, Line: () => null, CartesianGrid: () => null, Legend: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const run = (name: string) => ({ runId: name, runSlug: name, displayName: name, taskType: 'image_classification', modelType: 'resnet', architecture: 'resnet18', metric: { label: 'Accuracy', key: 'accuracy', direction: 'higher' }, series: { epoch: [1], trainMetric: [0.4], valMetric: [1] }, bestMetric: { value: 1, epoch: 1 }, finalMetric: { value: 1 }, epochsRecorded: 1, trainingParams: {} });

test('comparison shows metrics but does not render old hardcoded recommendations', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ runs: [run('First'), run('Second')], warnings: [], sharedMetric: { label: 'Accuracy', direction: 'higher' }, insights: [{ code: 'compare.overfit_most', params: { run: 'First', gap: -60 } }] }))));
  render(<CompareRunsDialog open onOpenChange={vi.fn()} datasetSlug="data" runIds={['first', 'second']} />);
  await screen.findByText('First');
  expect(screen.getByText('Second')).toBeTruthy();
  expect(screen.queryByText(/overfit/i)).toBeNull();
  expect(screen.queryByText(/suggest/i)).toBeNull();
});

test('comparison distinguishes existing runs with the same name', async () => {
  const first = { ...run('cv_run'), runId: '11111111-aaaa', createdAt: '2026-10-31T12:00:00Z' };
  const second = { ...run('cv_run'), runId: '22222222-bbbb', createdAt: '2026-10-31T13:00:00Z' };
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ runs: [first, second], warnings: [], sharedMetric: { label: 'Accuracy', direction: 'higher' } }))));
  render(<CompareRunsDialog open onOpenChange={vi.fn()} datasetSlug="data" runIds={[first.runId, second.runId]} />);
  expect(await screen.findByText(/cv_run \(.+11111111\)/)).toBeTruthy();
  expect(screen.getByText(/cv_run \(.+22222222\)/)).toBeTruthy();
});
