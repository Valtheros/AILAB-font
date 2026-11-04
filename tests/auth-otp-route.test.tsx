import { NextRequest } from 'next/server';
import { expect, test, vi } from 'vitest';

const handler = vi.hoisted(() => vi.fn(async () => new Response('ok')));
vi.mock('@/lib/auth', () => ({ auth: {} }));
vi.mock('@/lib/auth-database', () => ({ authUserExistsByEmail: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }));
vi.mock('better-auth/next-js', () => ({ toNextJsHandler: () => ({ GET: handler, POST: handler, PATCH: handler, PUT: handler, DELETE: handler }) }));

test('OTP check aliases are disabled while password reset still reaches Better Auth', async () => {
  const { POST } = await import('@/app/api/auth/[...all]/route');
  for (const path of ['/email-otp/check-verification-otp', '/email-otp/check-verification-otp/', '/email-otp/%63heck-verification-otp']) {
    const response = await POST(new NextRequest(`http://localhost/api/auth${path}`, { method: 'POST' }));
    expect(response.status).toBe(410);
    expect((await response.json()).code).toBe('OTP_FLOW_UPDATED');
  }
  expect(handler).not.toHaveBeenCalled();
  const response = await POST(new NextRequest('http://localhost/api/auth/email-otp/reset-password', { method: 'POST' }));
  expect(response.status).toBe(200);
  expect(handler).toHaveBeenCalledOnce();
});
