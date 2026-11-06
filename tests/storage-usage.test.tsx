import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StorageUsage } from '@/components/storage-usage';
import { StorageAdmin } from '@/app/admin/storage/storage-admin';

const state = vi.hoisted(() => ({ user: 'alice', language: 'en' }));
vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ language: state.language }) }));
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession: () => ({ data: { user: { id: state.user } } }) } }));
vi.mock('@/lib/api', () => ({ apiBaseUrl: () => '' }));
const fetchMock = vi.fn<typeof fetch>();
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const usage = { usedBytes: 20 * 1024 ** 3, limitBytes: 20 * 1024 ** 3, reservedBytes: 0,
  warning: 'full', breakdown: {}, reconciledAt: null };
beforeEach(() => { state.user = 'alice'; state.language = 'en'; fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('storage meter, full warning and refresh use server usage', async () => {
  fetchMock.mockResolvedValue(response(usage));
  render(<StorageUsage />);
  expect(await screen.findByRole('meter')).toBeTruthy();
  expect(screen.getByText(/Reading, downloading and deleting remain available/)).toBeTruthy();
  fetchMock.mockResolvedValue(response({ ...usage, usedBytes: 1, warning: null }));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh storage' }));
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
});

test('changing accounts cannot retain old storage figures', async () => {
  fetchMock.mockResolvedValueOnce(response(usage));
  const view = render(<StorageUsage />);
  await screen.findByRole('meter');
  fetchMock.mockImplementation(() => new Promise(() => {}));
  state.user = 'bob';
  view.rerender(<StorageUsage />);
  expect(screen.queryByRole('meter')).toBeNull();
});

test('storage errors are translated and the admin form submits GiB, not bytes', async () => {
  state.language = 'th';
  fetchMock.mockResolvedValueOnce(response({ code: 'STORAGE_UNAVAILABLE' }, 503));
  const view = render(<StorageUsage />);
  expect((await screen.findByRole('alert')).textContent).not.toContain('STORAGE_UNAVAILABLE');
  view.unmount();
  state.language = 'en';
  fetchMock.mockResolvedValueOnce(response({ total: 1, users: [{ id: 'alice', email: 'alice@example.invalid', state: 'ready', ...usage }] }));
  render(<StorageAdmin />);
  const input = await screen.findByRole('spinbutton', { name: 'Quota (GiB)' });
  fireEvent.change(input, { target: { value: '30' } });
  fetchMock.mockResolvedValueOnce(response({ ...usage, limitBytes: 30 * 1024 ** 3 }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/storage/admin/alice', expect.objectContaining({ method: 'PUT', body: '{"limitGiB":30}' })));
});
