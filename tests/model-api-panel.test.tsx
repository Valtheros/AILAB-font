import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ModelApiPanel } from '@/components/tasks/model-api-panel';
import { ModelApiGuide } from '@/components/guide/model-api-guide';

vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ language: 'en' }) }));
vi.mock('@/lib/api', () => ({ apiBaseUrl: () => '' }));
const session = vi.hoisted(() => ({ userId: 'alice' }));
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession: () => ({ data: { user: { id: session.userId } } }) } }));
const fetchMock = vi.fn<typeof fetch>();
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => { session.userId = 'alice'; fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('shows a new key once and does not embed it in the request example', async () => {
  const endpoint = { id: 'endpoint-1', enabled: true, checkpointSha256: 'hash' };
  fetchMock.mockImplementation(async (input, init) => {
    if (init?.method === 'POST') return response({ secret: 'ailab-once-only', key: { id: 'key-1', label: '', created_at: '', expires_at: '2027-01-01', revoked_at: null } });
    return String(input).includes('runSlug=') ? response({ endpoints: [endpoint] }) : response({ keys: [] });
  });
  render(<ModelApiPanel runSlug="run" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Create key' }));
  expect(await screen.findByText('ailab-once-only')).toBeTruthy();
  const example = screen.getByText(/curl -X POST/).textContent ?? '';
  expect(example).toContain('/api/v1/models/endpoint-1/predict');
  expect(example).toContain('$AILAB_API_KEY');
  expect(example).not.toContain('ailab-once-only');
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByText('ailab-once-only')).toBeNull());
});

test('does not offer endpoint creation when the feature is disabled', async () => {
  fetchMock.mockResolvedValue(response({ code: 'MODEL_API_DISABLED' }, 503));
  render(<ModelApiPanel runSlug="run" />);
  expect(await screen.findByText('Model API is not available yet.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Enable Model API' })).toBeNull();
});

test('clears a one-time key when the signed-in user changes', async () => {
  const endpoint = { id: 'endpoint-1', enabled: true, checkpointSha256: 'hash' };
  fetchMock.mockImplementation(async (input, init) => init?.method === 'POST'
    ? response({ secret: 'ailab-once-only', key: { id: 'key-1', label: '', expires_at: '2027-01-01', revoked_at: null } })
    : String(input).includes('runSlug=') ? response({ endpoints: [endpoint] }) : response({ keys: [] }));
  const view = render(<ModelApiPanel runSlug="run" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Create key' }));
  expect(await screen.findByText('ailab-once-only')).toBeTruthy();
  session.userId = 'bob';
  view.rerender(<ModelApiPanel runSlug="run" />);
  expect(screen.queryByText('ailab-once-only')).toBeNull();
});

test('guide shows a batch request and the shared upload limits', () => {
  render(<ModelApiGuide />);
  const example = screen.getByText(/curl .*predict-batch/).textContent ?? '';
  expect(example).toContain('-F "files=@image-1.jpg"');
  expect(example).toContain('-F "files=@image-2.jpg"');
  expect(screen.getByText(/100 images, 10 MiB each and 1 GiB total/)).toBeTruthy();
  expect(screen.getByText(/400: invalid input or ZIP/)).toBeTruthy();
});
