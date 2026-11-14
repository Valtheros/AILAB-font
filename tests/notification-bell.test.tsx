import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { NotificationBell } from '@/components/notification-bell';

const auth = vi.hoisted(() => ({ user: 'alice' }));
vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ language: 'en' }) }));
vi.mock('@/lib/api', () => ({ apiBaseUrl: () => '' }));
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession: () => ({ data: { user: { id: auth.user } } }) } }));
const fetchMock = vi.fn<typeof fetch>();
const response = (body: unknown) => new Response(JSON.stringify(body));
beforeEach(() => { auth.user = 'alice'; fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('displays unread notifications and marks them read', async () => {
  const item = { id: 'event', kind: 'train', status: 'completed', targetPath: '/tasks/run',
    createdAt: '2026-01-01T00:00:00Z', readAt: null };
  fetchMock.mockImplementation(async (_input, init) => init?.method === 'POST' ? response({ ok: true })
    : response({ notifications: [item], unreadCount: 1 }));
  render(<NotificationBell />);
  fireEvent.click(await screen.findByRole('button', { name: 'Notifications (1)' }));
  fireEvent.click(await screen.findByRole('link', { name: /Training completed/ }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/notifications/event/read', expect.objectContaining({ method: 'POST' })));
});

test('does not show the previous account notifications after switching accounts', async () => {
  fetchMock.mockImplementation(async () => auth.user === 'alice'
    ? response({ notifications: [{ id: 'event', kind: 'train', status: 'completed', targetPath: '/tasks/run',
      createdAt: '2026-01-01T00:00:00Z', readAt: null }], unreadCount: 1 })
    : response({ notifications: [], unreadCount: 0 }));
  const view = render(<NotificationBell />);
  expect(await screen.findByRole('button', { name: 'Notifications (1)' })).toBeTruthy();
  auth.user = 'bob'; view.rerender(<NotificationBell />);
  fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
  expect(screen.queryByText('Training completed')).toBeNull();
  expect(await screen.findByText('No notifications yet.')).toBeTruthy();
});
