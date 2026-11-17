// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { GET } from '@/app/api/backend/[[...path]]/route';

const state = vi.hoisted(() => ({ user: { id: 'psu-user', email: 'member@psu.ac.th', name: 'PSU member', emailVerified: true } as Record<string, unknown> | null, fetch: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: async () => state.user ? { user: state.user } : null } } }));
beforeEach(() => {
  vi.stubEnv('BACKEND_INTERNAL_URL', 'http://backend:8000'); vi.stubEnv('BACKEND_INTERNAL_TOKEN', 'fixture-internal-token');
  state.user = { id: 'psu-user', email: 'member@psu.ac.th', name: 'PSU member', emailVerified: true };
  state.fetch.mockReset().mockResolvedValue(Response.json({ ok: true })); vi.stubGlobal('fetch', state.fetch);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

test.each([['storage', 'PSU member'], ['storage', '\u0e2a\u0e21\u0e0a\u0e32\u0e22 PSU'], ['tasks', 'PSU \ud83c\udf93']])('proxy supports %s for a Unicode display name: %s', async (endpoint, name) => {
  state.user!.name = name;
  const request = new NextRequest(`https://ailab.example/api/backend/api/${endpoint}?offset=0`, { headers: { 'x-user-id': 'spoofed', 'x-user-name': 'untrusted', 'x-internal-token': 'spoofed' } });
  const response = await GET(request, { params: Promise.resolve({ path: ['api', endpoint] }) });
  expect(response.status).toBe(200);
  const [url, init] = state.fetch.mock.calls[0];
  expect(String(url)).toBe(`http://backend:8000/api/${endpoint}?offset=0`);
  expect(init.headers.get('x-user-id')).toBe('psu-user'); expect(init.headers.get('x-user-email')).toBe('member@psu.ac.th');
  expect(init.headers.get('x-internal-token')).toBe('fixture-internal-token');
  expect(init.headers.has('x-user-name')).toBe(false);
});
test.each([null, { id: 'unverified', emailVerified: false }])('missing or unverified sessions never reach backend: %j', async user => {
  state.user = user;
  const response = await GET(new NextRequest('https://ailab.example/api/backend/api/storage'), { params: Promise.resolve({ path: ['api', 'storage'] }) });
  expect(response.status).toBe(user ? 403 : 401); expect(state.fetch).not.toHaveBeenCalled();
});
