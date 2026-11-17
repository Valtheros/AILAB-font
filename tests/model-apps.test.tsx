import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppViewer } from '@/components/model-apps/app-viewer';
import { appMessage, appRequest, AppRequestError } from '@/lib/model-apps';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('job=visitor-job') }));
vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ language: 'en' }) }));
vi.mock('@/lib/api', () => ({ apiBaseUrl: () => '/api/backend' }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('app wait reasons describe the owner quota, not a visitor GPU quota', () => {
  expect(appMessage('user_quota', false)).toContain("model owner's");
  expect(appMessage('APP_TEST_REQUIRED', true)).toContain('ทดสอบ');
});

test('request failures retain their HTTP status and hide proxy error pages', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>proxy rejected upload</html>', { status: 413 })));
  await expect(appRequest('/api/apps/owner/model/predict', true, { method: 'POST' }))
    .rejects.toMatchObject({ status: 413, message: appMessage('IMAGE_TOO_LARGE', true) });
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
  await expect(appRequest('/api/apps/owner/model/predict', true, { method: 'POST' })).rejects.toBeInstanceOf(AppRequestError);
});

test('shared app restores a private queued job and cancels using session routes without keys', async () => {
  const job = { id: 'visitor-job', appId: 'app-1', version: 2, kind: 'predict', status: 'queued', queueReason: 'user_quota', createdAt: '2026-11-15T00:00:00Z' };
  const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path.endsWith('/cancel')) return Response.json({ ...job, status: 'cancelled', queueReason: null });
    if (path.includes('/jobs/')) return Response.json(job);
    expect(init?.headers).toBeUndefined();
    return Response.json({ id: 'app-1', name: 'Road classifier', description: '', path: '/apps/owner/model', published: true, version: 2, taskType: 'image_classification', isOwner: false, jobs: [] });
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<AppViewer owner="owner" slug="model" />);
  expect(await screen.findByText("Waiting for the model owner's earlier GPU jobs to finish.")).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel prediction' }));
  await waitFor(() => expect(screen.getByText('Cancelled · v2')).toBeTruthy());
  expect(fetchMock.mock.calls.some(([path, init]) => path.endsWith('/cancel') && init?.method === 'POST')).toBe(true);
  expect(fetchMock.mock.calls.every(([, init]) => !new Headers(init?.headers).has('Authorization'))).toBe(true);
});

test('rejects a prediction from a different app before displaying its output', async () => {
  vi.stubGlobal('fetch', vi.fn(async (path: string) => Response.json(path.includes('/jobs/')
    ? { id: 'visitor-job', appId: 'other-app', status: 'completed', version: 1 }
    : { id: 'app-1', name: 'Road classifier', description: '', path: '/apps/owner/model', published: true, version: 2, taskType: 'image_classification', isOwner: false, jobs: [] })));
  render(<AppViewer owner="owner" slug="model" />);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', appMessage('NOT_FOUND', false));
  expect(screen.queryByRole('button', { name: 'JSON' })).toBeNull();
});
