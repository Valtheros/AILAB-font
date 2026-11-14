import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { BatchTest } from '@/components/tasks/batch-test';

type SelectorProps = ComponentProps<typeof import('@/components/tasks/execution-selector').ExecutionSelector>;
vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ language: 'en' }) }));
vi.mock('@/lib/api', () => ({ apiBaseUrl: () => '' }));
vi.mock('@/components/tasks/execution-selector', () => ({
  ExecutionSelector: ({ value, onChange }: SelectorProps) => <select aria-label="Device" value={value.mode}
    onChange={(event) => onChange({ mode: event.target.value as 'auto' | 'cpu' })}><option value="auto">Auto</option><option value="cpu">CPU</option></select>,
}));

const job = { id: 'batch-job', kind: 'batch_predict', status: 'completed', requestedExecution: { mode: 'auto' }, progress: { current: 2, total: 2 } };
const response = (body: unknown) => new Response(JSON.stringify(body));
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('submits a batch and displays the saved per-image results', async () => {
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.includes('runSlug=')) return response({ job: null });
    if (init?.method === 'POST') return response({ ...job, status: 'queued' });
    if (url.endsWith('/batch-result')) return response({ total: 2, succeeded: 1, failed: 1, images: [
      { filename: 'good.png', status: 'completed', result: { top: { className: 'cat', percent: 90 } } },
      { filename: 'bad.png', status: 'error', error: 'Unreadable image' },
    ] });
    return response(job);
  });
  render(<BatchTest runSlug="run" />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  const input = document.querySelector('input[type=file]');
  if (!input) throw new Error('File input missing');
  fireEvent.change(input, { target: { files: [new File(['ok'], 'good.png'), new File(['bad'], 'bad.png')] } });
  fireEvent.click(screen.getByRole('button', { name: 'Test images' }));
  expect(await screen.findByText('good.png')).toBeTruthy();
  expect(screen.getByText('Unreadable image')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'ZIP' }).getAttribute('href')).toContain('/batch-job/files/results.zip');
  const submit = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/predict-batch') && init?.method === 'POST');
  expect((submit?.[1]?.body as FormData).getAll('files')).toHaveLength(2);
});

test('restores the latest batch after reopening', async () => {
  fetchMock.mockImplementation(async (input) => String(input).includes('runSlug=') ? response({ job })
    : String(input).endsWith('/batch-result') ? response({ total: 1, succeeded: 1, failed: 0, images: [{ filename: 'restored.jpg', status: 'completed', result: { count: 2 } }] })
      : response(job));
  render(<BatchTest runSlug="run" />);
  expect(await screen.findByText('restored.jpg')).toBeTruthy();
});

test('shows the actual failure when an unfinished batch has no results file', async () => {
  const failed = { ...job, status: 'failed', errorCode: 'COMPUTE_FAILED', error: 'Model checkpoint is invalid.',
    expiresAt: '2099-01-01T00:00:00Z' };
  fetchMock.mockImplementation(async (input) => String(input).includes('runSlug=') ? response({ job: failed })
    : String(input).endsWith('/batch-result') ? new Response('{}', { status: 410 }) : response(failed));
  render(<BatchTest runSlug="run" />);
  expect(await screen.findByText('Model checkpoint is invalid.')).toBeTruthy();
  expect(screen.queryByText('This result has expired.')).toBeNull();
});
