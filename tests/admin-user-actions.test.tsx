// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { deleteUserAndDataAction, removeUserAction } from '@/app/admin/users/actions';

const fixture = vi.hoisted(() => ({
  query: vi.fn(), admin: vi.fn(), revalidate: vi.fn(),
  exists: true, storage: true, resources: 0, events: [] as string[],
}));
vi.mock('@/lib/auth-database', () => ({ authDatabasePool: { query: fixture.query } }));
vi.mock('@/lib/admin-auth', () => ({ requireAdminForAction: fixture.admin }));
vi.mock('@/lib/auth', () => ({ auth: { api: {} } }));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: fixture.revalidate }));

beforeEach(() => {
  vi.resetAllMocks();
  fixture.exists = true; fixture.storage = true; fixture.resources = 0; fixture.events = [];
  fixture.admin.mockResolvedValue({ user: { id: 'admin', email: 'admin@example.test' } });
  vi.stubEnv('BACKEND_INTERNAL_URL', 'http://backend.test');
  vi.stubEnv('BACKEND_INTERNAL_TOKEN', 'fixture-internal-token');
  fixture.query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('select id')) return { rowCount: fixture.exists ? 1 : 0, rows: [] };
    if (sql.includes('to_regclass')) return { rows: [{}] };
    if (sql.includes('"workspaceMemberships"')) return { rows: [{ workspaceMemberships: 0, projects: 0,
      datasets: fixture.resources, trainingRuns: 0, labelStudioAccounts: 0, legacyAnnotations: 0,
      datasetVersionRecords: 0, modelAppResources: 0 }] };
    if (sql.startsWith('update "user"')) fixture.events.push('disable');
    if (sql.startsWith('delete from session')) fixture.events.push('revoke-sessions');
    if (sql.startsWith('delete from "user"')) {
      if (fixture.storage) throw Object.assign(new Error('storage_accounts_owner_user_id_fkey'), { code: '23503' });
      fixture.events.push('delete-user'); fixture.exists = false;
    }
    return { rowCount: 1, rows: [] };
  });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    expect(url).toBe('http://backend.test/api/admin/users/target/resources');
    expect(init.method).toBe('DELETE');
    const headers = new Headers(init.headers);
    expect(headers.get('x-user-id')).toBe('admin');
    expect(headers.get('x-internal-token')).toBe('fixture-internal-token');
    fixture.events.push('cleanup-storage'); fixture.storage = false;
    return Response.json({ status: 'success', datasets: 0, runs: 0 });
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

test('Remove retires an automatically allocated quota before deleting an otherwise empty account', async () => {
  expect(await removeUserAction('target')).toMatchObject({ ok: true });
  expect(fixture.events).toEqual(['disable', 'revoke-sessions', 'cleanup-storage', 'delete-user']);
  expect(fixture.storage).toBe(false);
  expect(fixture.exists).toBe(false);
  expect(fixture.revalidate).toHaveBeenCalledWith('/admin/users');
});

test('the explicit account-and-data path uses the same cleanup ordering', async () => {
  expect(await deleteUserAndDataAction('target')).toMatchObject({ ok: true });
  expect(fixture.events).toEqual(['disable', 'revoke-sessions', 'cleanup-storage', 'delete-user']);
});

test.each([409, 503])('failed cleanup (%s) retains the account and quota, then allows a retry', async status => {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ detail: 'Wait for active uploads or restore storage first.' }, { status }));
  expect(await removeUserAction('target')).toEqual({ ok: false, message: 'Wait for active uploads or restore storage first.' });
  expect(fixture.exists).toBe(true); expect(fixture.storage).toBe(true);
  expect(fixture.events).not.toContain('delete-user');
  expect(await removeUserAction('target')).toMatchObject({ ok: true });
  expect(fixture.events.filter(event => event === 'delete-user')).toHaveLength(1);
});

test('Remove still requires explicit confirmation for accounts with owned data', async () => {
  fixture.resources = 1;
  expect(await removeUserAction('target')).toMatchObject({ ok: false, message: expect.stringContaining('still owns resources') });
  expect(fixture.events).toEqual([]); expect(fetch).not.toHaveBeenCalled();
});

test.each([
  [null, 'The data management service returned an invalid response. Please retry.'],
  [{}, 'Account cleanup was not confirmed. The account was kept; please retry.'],
])('an empty or unconfirmed success cannot delete the auth account: %j', async (body, message) => {
  vi.mocked(fetch).mockResolvedValueOnce(body === null ? new Response('') : Response.json(body));
  expect(await removeUserAction('target')).toEqual({ ok: false, message });
  expect(fixture.exists).toBe(true); expect(fixture.storage).toBe(true);
  expect(fixture.events).not.toContain('delete-user');
});

test('a connection failure is actionable and preserves the auth account', async () => {
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError('fetch failed'));
  expect(await removeUserAction('target')).toEqual({ ok: false, message: 'Cannot reach the data management service. Please try again later.' });
  expect(fixture.exists).toBe(true); expect(fixture.storage).toBe(true);
  expect(fixture.events).not.toContain('delete-user');
});

test.each([removeUserAction, deleteUserAndDataAction])('self deletion is rejected before cleanup', async action => {
  expect(await action('admin')).toEqual({ ok: false, message: 'You cannot remove your own account.' });
  expect(fixture.events).toEqual([]); expect(fetch).not.toHaveBeenCalled();
});

test.each([removeUserAction, deleteUserAndDataAction])('non-admin deletion cannot reach storage or auth records', async action => {
  fixture.admin.mockRejectedValue(new Error('Admin access is required.'));
  expect(await action('target')).toEqual({ ok: false, message: 'Admin access is required.' });
  expect(fixture.query).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});

test('a missing target cannot trigger cleanup', async () => {
  fixture.exists = false;
  expect(await removeUserAction('target')).toEqual({ ok: false, message: 'User not found.' });
  expect(fixture.events).toEqual([]); expect(fetch).not.toHaveBeenCalled();
});
