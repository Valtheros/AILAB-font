import { afterEach, expect, test, vi } from 'vitest';
import { getMicrosoftAuthConfig } from '@/lib/microsoft-auth';

const configured = { MICROSOFT_AUTH_ENABLED: 'true', MICROSOFT_CLIENT_ID: '11111111-1111-1111-1111-111111111111',
  MICROSOFT_CLIENT_SECRET: 'fixture-secret', MICROSOFT_TENANT_ID: '22222222-2222-2222-2222-222222222222' };

test('disabled Microsoft needs no credentials', () => {
  expect(getMicrosoftAuthConfig({})).toBeUndefined();
  expect(getMicrosoftAuthConfig({ ...configured, MICROSOFT_AUTH_ENABLED: 'false' })).toBeUndefined();
});
test.each(['common', 'organizations', 'consumers', '9188040d-6c67-4c5b-b112-36a304b66dad', '', 'psu.ac.th'])('rejects an unrestricted or invalid tenant: %s', tenant => {
  expect(() => getMicrosoftAuthConfig({ ...configured, MICROSOFT_TENANT_ID: tenant })).toThrow('specific organizational');
});
test.each(['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET', 'MICROSOFT_TENANT_ID'])('enabled login requires %s', key => {
  expect(() => getMicrosoftAuthConfig({ ...configured, [key]: '' })).toThrow('Microsoft login requires');
});
test('provider uses only OIDC scopes and never marks an Entra email verified', async () => {
  const provider = getMicrosoftAuthConfig(configured)!;
  expect(provider.tenantId).toBe(configured.MICROSOFT_TENANT_ID);
  expect(provider.scope).toEqual(['openid', 'profile', 'email']);
  expect(provider.disableDefaultScope).toBe(true);
  expect(provider.disableProfilePhoto).toBe(true);
  expect(await provider.mapProfileToUser!({} as never)).toEqual({ emailVerified: false, image: undefined });
});

vi.mock('better-auth', () => ({ betterAuth: (options: unknown) => ({ options }) }));
vi.mock('better-auth/plugins', () => ({ admin: () => ({}), emailOTP: () => ({}) }));
vi.mock('better-auth/api', () => ({ createAuthMiddleware: (handler: unknown) => handler, getSessionFromCtx: async () => ({ user: { id: 'member-id', emailVerified: true } }), APIError: class extends Error {} }));
vi.mock('@/lib/auth-database', () => ({ authDatabasePool: {} }));
vi.mock('@/lib/auth-email', () => ({ assertAuthEmailDeliveryConfigured: () => {}, sendEmailVerificationLink: () => {}, sendOtpEmail: () => {} }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
test('Microsoft admission checks tenant and email, including returning identities', async () => {
  for (const [key, value] of Object.entries(configured)) vi.stubEnv(key, value);
  const { auth, microsoftAuthEnabled } = await import('@/lib/auth');
  expect(microsoftAuthEnabled).toBe(true);
  expect(auth.options.account?.accountLinking).toMatchObject({ disableImplicitLinking: true, allowDifferentEmails: false, updateUserInfoOnLink: false });
  const validate = auth.options.user!.validateUserInfo!;
  for (const action of ['create-user', 'link-account', 'sign-in'] as const) {
    const source = { action, method: 'oauth' as const, oauth: { providerId: 'microsoft', profile: { tid: configured.MICROSOFT_TENANT_ID } } };
    expect(await validate({ user: { id: 'member-id', email: 'member@psu.ac.th' }, source }, {} as never)).toBeUndefined();
    expect(await validate({ user: { email: 'member@psu.ac.th' }, source: { ...source, oauth: { ...source.oauth, profile: { tid: 'other' } } } }, {} as never)).toMatchObject({ error: 'invalid_organization' });
    expect(await validate({ user: { email: 'not-an-email' }, source }, {} as never)).toMatchObject({ error: 'email_not_found' });
  }
});
