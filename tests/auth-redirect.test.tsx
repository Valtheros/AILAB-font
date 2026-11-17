import { expect, test } from 'vitest';
import { NextRequest } from 'next/server';
import { safeCallbackURL, authHref } from '@/lib/auth-redirect';
import { proxy } from '@/proxy';

test.each([
  undefined, '', 'https://evil.example', '//evil.example', '/\\evil.example',
  '/%2f%2fevil.example', '/%252f%252fevil.example', '/%5cevil.example',
  '/%255cevil.example', '/%0aevil.example', '/%E0%A4%A', '/%252525252f',
  '/login', '/signup?callbackURL=/login', '/forgot-password', '/auth-error',
  '/api/auth/sign-out', '/label-studio/', '/dataset/../login', '/dataset/%2e%2e/login',
  '/dataset/%252e%252e/login', '/dashboard\n', '/dataset-not-a-page',
])('rejects unsafe or looping callbacks: %s', (value) => {
  expect(safeCallbackURL(value)).toBe('/dashboard');
});

test.each(['/', '/overview', '/apps/user-id/model-name?job=abc', '/dataset?search=hello%20world', '/tasks/task-1#results',
  '/annotate?project=3&transfer=12345678-1234-1234-1234-123456789012'])('preserves local callback %s', (path) => {
  expect(safeCallbackURL(path)).toBe(path);
  expect(new URL(authHref('signup', path), 'https://ailab.test').searchParams.get('callbackURL')).toBe(path);
});

test.each(['/', '/overview', '/guide?tab=models', '/login', '/signup'])('public route is not redirected: %s', (path) => {
  expect(proxy(new NextRequest(`https://ailab.test${path}`)).status).toBe(200);
});

test.each(['/apps', '/apps/user/model?version=1', '/dashboard', '/dataset', '/tasks', '/annotate', '/annotate?project=3&transfer=abc', '/dataset/123', '/tasks/123?tab=results', '/account', '/admin/users', '/admin/compute', '/config', '/training', '/results', '/annotate/private'])('protects exact private paths: %s', (path) => {
  const response = proxy(new NextRequest(`https://ailab.test${path}`));
  const location = new URL(response.headers.get('location')!);
  expect(location.pathname).toBe('/login');
  expect([...location.searchParams.keys()]).toEqual(['callbackURL']);
  expect(location.searchParams.get('callbackURL')).toBe(path);
});

test('an invalid cookie does not redirect login to a protected page', () => {
  const request = new NextRequest('https://ailab.test/login', { headers: { cookie: 'better-auth.session_token=expired' } });
  expect(proxy(request).status).toBe(200);
});
