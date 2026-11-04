import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { EvaluationPanel } from '@/components/tasks/evaluation-panel';

const locale = vi.hoisted(() => ({ language: 'en' }));
vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ language: locale.language }) }));
vi.mock('@/lib/api', () => ({ apiBaseUrl: () => '' }));
vi.mock('@/components/tasks/execution-selector', () => ({ ExecutionSelector: () => <div>Device selection</div> }));

const fetchMock = vi.fn<typeof fetch>();
const response = (body: unknown) => new Response(JSON.stringify(body));
beforeEach(() => { locale.language = 'en'; fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('shows persisted evaluation metrics and an incorrect image without inventing a winner', async () => {
  const evaluation = { id: 'eval-1', status: 'completed', origin: 'automatic', datasetName: 'Roads', datasetVersion: 1,
    createdAt: '2026-01-01T00:00:00Z', report: { evaluated: 2, skipped: 0, sourceVerified: true,
      metrics: { accuracy: .5, classes: [{ name: 'curve', support: 2, precision: 1, recall: .5, f1: 2 / 3 }] } } };
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/evaluations')) return response({ evaluations: [evaluation] });
    if (url.endsWith('/datasets')) return response({ datasets: [] });
    if (url.includes('/images?')) return response({ total: 1, images: [{ ordinal: 0, filename: 'incorrect.png', outcome: 'incorrect' }] });
    if (url.endsWith('/images/0')) return response({ actual: 'curve', predicted: 'junction', confidence: .8 });
    return response(evaluation);
  });
  render(<EvaluationPanel runSlug="run" modelType="resnet" taskType="image_classification" />);
  expect((await screen.findAllByText('50.00%')).length).toBeGreaterThan(0);
  fireEvent.click(await screen.findByRole('button', { name: /incorrect.png/ }));
  expect(await screen.findByText('junction')).toBeTruthy();
  expect(screen.queryByText(/winner|overfit/i)).toBeNull();
});

test('clearly reports that the selected dataset has no test split', async () => {
  const evaluation = { id: 'eval-2', status: 'no_test', origin: 'automatic', datasetName: 'Roads',
    createdAt: '2026-01-01T00:00:00Z', report: { evaluated: 0, skipped: 0, metrics: null } };
  fetchMock.mockImplementation(async (input) => String(input).endsWith('/evaluations')
    ? response({ evaluations: [evaluation] }) : String(input).endsWith('/datasets') ? response({ datasets: [] }) : response(evaluation));
  render(<EvaluationPanel runSlug="run" modelType="resnet" taskType="image_classification" />);
  expect(await screen.findByText('This dataset version has no test split.')).toBeTruthy();
});

test('translates evaluation and image statuses in Thai', async () => {
  locale.language = 'th';
  const evaluation = { id: 'eval-3', status: 'completed', origin: 'automatic', datasetName: 'Roads',
    createdAt: '2026-01-01T00:00:00Z', report: { evaluated: 1, skipped: 0, metrics: { accuracy: 1 } } };
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/evaluations')) return response({ evaluations: [evaluation] });
    if (url.endsWith('/datasets')) return response({ datasets: [] });
    if (url.includes('/images?')) return response({ total: 1, images: [{ ordinal: 0, filename: 'wrong.png', outcome: 'incorrect' }] });
    return response(evaluation);
  });
  render(<EvaluationPanel runSlug="run" modelType="resnet" taskType="image_classification" />);
  expect(await screen.findByText('สถานะ: สำเร็จ')).toBeTruthy();
  expect(await screen.findByText('ทำนายผิด')).toBeTruthy();
});
