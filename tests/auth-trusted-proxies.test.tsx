import { getIPFromHeader } from '@better-auth/core/utils/ip';
import { afterEach, expect, test, vi } from 'vitest';

vi.mock('better-auth', () => ({ betterAuth: (options: unknown) => ({ options }) }));
vi.mock('better-auth/plugins', () => ({ admin: () => ({}), emailOTP: () => ({}) }));
vi.mock('@/lib/auth-database', () => ({ authDatabasePool: {} }));
vi.mock('@/lib/auth-email', () => ({
  assertAuthEmailDeliveryConfigured: () => undefined,
  sendEmailVerificationLink: () => undefined,
  sendOtpEmail: () => undefined,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

test('trusted proxy chain identifies the nearest untrusted client and ignores spoofed entries', async () => {
  vi.stubEnv('TRUSTED_PROXY_IPS', '192.0.2.1/32, 2001:db8::1/128');
  const { auth } = await import('@/lib/auth');
  const trustedProxies = auth.options.advanced?.ipAddress?.trustedProxies;
  expect(trustedProxies).toEqual(['192.0.2.1/32', '2001:db8::1/128']);
  expect(auth.options.disabledPaths).toContain('/email-otp/check-verification-otp');
  expect(getIPFromHeader('203.0.113.55, 198.51.100.9, 192.0.2.1', { trustedProxies })).toBe('198.51.100.9');
});

test('without configured proxies a multi-hop client address fails closed', async () => {
  vi.stubEnv('TRUSTED_PROXY_IPS', '');
  const { auth } = await import('@/lib/auth');
  const trustedProxies = auth.options.advanced?.ipAddress?.trustedProxies;
  expect(trustedProxies).toEqual([]);
  expect(getIPFromHeader('203.0.113.55, 198.51.100.9', { trustedProxies })).toBeNull();
  expect(getIPFromHeader('198.51.100.9', { trustedProxies })).toBe('198.51.100.9');
});
