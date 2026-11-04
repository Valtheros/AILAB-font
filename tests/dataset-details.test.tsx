import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import DatasetDetailsPage from '@/app/dataset/[datasetId]/page';

const testLanguage = vi.hoisted(() => ({ value: 'en' }));
vi.mock('next/navigation', () => ({ useParams: () => ({ datasetId: 'dataset-id' }) }));
vi.mock('@/components/MainLayout', () => ({ MainLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ language: testLanguage.value }) }));
vi.mock('@/lib/api', () => ({ apiBaseUrl: () => '' }));
const fetchMock = vi.fn<typeof fetch>();
const response = (body: unknown) => new Response(JSON.stringify(body));
beforeEach(() => { testLanguage.value = 'en'; fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('shows thumbnail summaries and loads annotations only for the selected image', async () => {
  const details = { name: 'Roads', version: 1, index: { status: 'completed', ready: true, total: 2, processed: 2, skipped: 0,
    stats: { train: { images: 1, pixels: 0, classes: { curve: { images: 1, objects: 0, pixels: 0 } } }, test: { images: 1, pixels: 0, classes: {} } } } };
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/images?')) return response({ total: 1, images: [{ ordinal: 0, filename: 'a.jpg', split: 'train', classes: ['curve'], hasObjects: true }] });
    if (url.includes('/duplicates?')) return response({ groups: [], total: 0 });
    if (url.endsWith('/images/0')) return response({ ordinal: 0, filename: 'a.jpg', split: 'train', width: 4, height: 4, annotations: { kind: 'classification', className: 'curve' } });
    return response(details);
  });
  render(<DatasetDetailsPage />);
  const button = await screen.findByRole('button', { name: /a.jpg/ });
  const thumbnail = button.querySelector('img');
  expect(thumbnail?.getAttribute('src')).toBe('/api/dataset-versions/dataset-id/images/0/thumbnail');
  expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/images/0'))).toBe(false);
  fireEvent.click(button);
  expect(await screen.findByText('curve', { selector: 'strong' })).toBeTruthy();
  expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/images/0'))).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.change(await screen.findByRole('textbox', { name: 'Search filename' }), { target: { value: 'road' } });
  await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes('search=road'))).toBe(true));
});

test('shows an indexing error and a retry action', async () => {
  fetchMock.mockResolvedValue(response({ name: 'Roads', index: { status: 'failed', ready: false, total: 2, processed: 1, skipped: 1, error: 'Worker unavailable', stats: {} } }));
  render(<DatasetDetailsPage />);
  expect(await screen.findByText('Worker unavailable')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  expect(screen.queryByRole('progressbar')).toBeNull();
});

test('shows a waiting state instead of 0 / 0 when the index total is unknown', async () => {
  fetchMock.mockResolvedValue(response({ name: 'Roads', index: { status: 'queued', ready: false, total: 0, processed: 0, skipped: 0, stats: {} } }));
  render(<DatasetDetailsPage />);
  expect(await screen.findByText('Waiting to start')).toBeTruthy();
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBeNull();
  expect(screen.queryByText(/0 \/ 0/)).toBeNull();
});

test('offers retry when loading the dataset initially fails', async () => {
  fetchMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(response({ name: 'Roads', index: { status: 'queued', ready: false, total: 0, processed: 0, skipped: 0, stats: {} } }));
  render(<DatasetDetailsPage />);
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByRole('progressbar')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Waiting to start')).toBeTruthy();
});

test('shows translated indexing progress and skipped images', async () => {
  testLanguage.value = 'th';
  fetchMock.mockResolvedValue(response({ name: 'Roads', index: { status: 'running', ready: false, total: 100, processed: 25, skipped: 2, stats: {} } }));
  render(<DatasetDetailsPage />);
  expect(await screen.findByText('กำลังเตรียมรูปภาพ')).toBeTruthy();
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25');
  expect(screen.getByText('25 / 100 ภาพ')).toBeTruthy();
  expect(screen.getByText('ข้าม: 2')).toBeTruthy();
});

test('shows image detail errors in the dialog instead of a permanent loading state', async () => {
  const details = { name: 'Roads', index: { status: 'completed', ready: true, total: 1, processed: 1, skipped: 0, stats: {} } };
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/images?')) return response({ total: 1, images: [{ ordinal: 0, filename: 'a.jpg', split: 'train', classes: [], hasObjects: true }] });
    if (url.includes('/duplicates?')) return response({ groups: [], total: 0 });
    if (url.endsWith('/images/0')) return new Response('', { status: 500 });
    return response(details);
  });
  render(<DatasetDetailsPage />);
  fireEvent.click(await screen.findByRole('button', { name: /a.jpg/ }));
  const dialog = screen.getByRole('dialog');
  expect((await within(dialog).findByRole('alert')).textContent).toBe('Could not load image details.');
  expect(within(dialog).queryByRole('status')).toBeNull();
});

test('hides the previous split while the next split loads', async () => {
  const details = { name: 'Roads', version: 1, index: { status: 'completed', ready: true, total: 2, processed: 2, skipped: 0,
    stats: { train: { images: 1, pixels: 0, classes: {} }, test: { images: 1, pixels: 0, classes: {} } } } };
  let resolveTest: (value: Response) => void = () => undefined;
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('split=test')) return new Promise<Response>((resolve) => { resolveTest = resolve; });
    if (url.includes('/images?')) return response({ total: 1, images: [{ ordinal: 0, filename: 'train.jpg', split: 'train', classes: [], hasObjects: true }] });
    if (url.includes('/duplicates?')) return response({ groups: [], total: 0 });
    return response(details);
  });
  render(<DatasetDetailsPage />);
  expect(await screen.findByRole('button', { name: /train.jpg/ })).toBeTruthy();
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Test (1)' }), { button: 0 });
  expect(screen.queryByRole('button', { name: /train.jpg/ })).toBeNull();
  expect(screen.getByRole('status').textContent).toContain('Loading images');
  resolveTest(response({ total: 1, images: [{ ordinal: 1, filename: 'test.jpg', split: 'test', classes: [], hasObjects: true }] }));
  expect(await screen.findByRole('button', { name: /test.jpg/ })).toBeTruthy();
});
