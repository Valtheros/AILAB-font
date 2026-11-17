// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { betterAuth } from 'better-auth';

const state = vi.hoisted(() => ({
  db: { user: [], session: [], account: [], verification: [] } as Record<string, Record<string, unknown>[]>,
  emails: [] as { to: string; url: string }[], otps: [] as { email: string; otp: string; type: string }[],
}));
vi.mock('@/lib/auth-database', async () => {
  const { memoryAdapter } = await import('better-auth/adapters/memory');
  return { authDatabasePool: memoryAdapter(state.db) };
});
vi.mock('@/lib/auth-email', () => ({
  assertAuthEmailDeliveryConfigured: () => {},
  sendEmailVerificationLink: (email: { to: string; url: string }) => { state.emails.push(email); },
  sendOtpEmail: (otp: { email: string; otp: string; type: string }) => { state.otps.push(otp); },
}));

const base = 'http://localhost:3000';
const tenant = '22222222-2222-2222-2222-222222222222';
const client = '11111111-1111-1111-1111-111111111111';
const identity = { oid: '33333333-3333-3333-3333-333333333333', sub: 'pairwise-subject', tid: tenant,
  email: 'member@psu.ac.th', name: 'PSU member', email_verified: false };
async function createTestAuth() {
  const configured = (await import('@/lib/auth')).auth;
  return betterAuth({ ...configured.options, rateLimit: { enabled: false },
    // Better Auth skips origin checks in test mode unless explicitly enabled.
    advanced: { ...configured.options.advanced, disableOriginCheck: false, disableCSRFCheck: false },
  });
}
let auth: Awaited<ReturnType<typeof createTestAuth>>;
let signingKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
let wrongKey: typeof signingKey;
const codes = new Map<string, { claims: Record<string, unknown>; challenge: string; audience?: string; issuer?: string; badSignature?: boolean; expired?: boolean }>();
let exchanges = 0;

function cookies(...responses: Response[]) {
  const values = new Map<string, string>();
  for (const response of responses) for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';')[0]; values.set(pair.split('=')[0], pair);
  }
  return [...values.values()].join('; ');
}
function request(path: string, body?: unknown, cookie = '') {
  return auth.handler(new Request(new URL(path, base), {
    method: body ? 'POST' : 'GET', headers: { origin: base, cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }));
}
async function start(cookie = '', linking = false) {
  const response = await request('/api/auth/' + (linking ? 'link-social' : 'sign-in/social'), {
    provider: 'microsoft', callbackURL: '/dataset?search=road', errorCallbackURL: '/auth-error?callbackURL=%2Fdataset',
  }, cookie);
  expect(response.status).toBe(200);
  const url = new URL((await response.json()).url);
  expect(url.origin + url.pathname).toBe(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
  expect(url.searchParams.get('redirect_uri')).toBe(base + '/api/auth/callback/microsoft');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url.searchParams.get('scope')?.split(' ').sort()).toEqual(['email', 'openid', 'profile']);
  expect(url.searchParams.get('client_secret')).toBeNull();
  return { response, url, cookie };
}
async function finish(flow: Awaited<ReturnType<typeof start>>, claims: Record<string, unknown> = identity, options: { audience?: string; issuer?: string; badSignature?: boolean; expired?: boolean } = {}) {
  const code = randomUUID();
  codes.set(code, { claims, challenge: flow.url.searchParams.get('code_challenge')!, ...options });
  const stateValue = flow.url.searchParams.get('state')!;
  const cookie = [flow.cookie, cookies(flow.response)].filter(Boolean).join('; ');
  const path = '/api/auth/callback/microsoft?' + new URLSearchParams({ code, state: stateValue });
  const response = await request(path, undefined, cookie);
  return { response, cookie: [cookie, cookies(response)].filter(Boolean).join('; '), path };
}
async function member(email = identity.email) {
  const signup = await request('/api/auth/sign-up/email', { email, name: 'Existing owner', password: 'fixture-password-123' });
  expect(signup.status).toBe(200);
  const verification = await request(state.emails.at(-1)!.url);
  expect(verification.status).toBe(302);
  const user = state.db.user.find(row => row.email === email)!;
  user.role = 'admin';
  const response = await request('/api/auth/sign-in/email', { email, password: 'fixture-password-123' });
  expect(response.status).toBe(200); return { user, cookie: cookies(response), response };
}
beforeAll(async () => {
  vi.stubEnv('MICROSOFT_AUTH_ENABLED', 'true'); vi.stubEnv('MICROSOFT_CLIENT_ID', client);
  vi.stubEnv('MICROSOFT_CLIENT_SECRET', 'fixture-only-not-a-real-secret'); vi.stubEnv('MICROSOFT_TENANT_ID', tenant);
  vi.stubEnv('BETTER_AUTH_URL', base); vi.stubEnv('BETTER_AUTH_TRUSTED_ORIGINS', base);
  vi.stubEnv('BETTER_AUTH_SECRET', 'isolated-microsoft-oauth-test-secret-123456789');
  const keys = await generateKeyPair('RS256'); signingKey = keys.privateKey;
  wrongKey = (await generateKeyPair('RS256')).privateKey;
  const jwk = { ...await exportJWK(keys.publicKey), kid: 'fixture-key', alg: 'RS256', use: 'sig' };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.href === `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`) return Response.json({ keys: [jwk] });
    if (url.href === `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`) {
      exchanges++;
      const params = new URLSearchParams(String(init?.body)); const pending = codes.get(params.get('code')!);
      expect(pending).toBeTruthy();
      expect(createHash('sha256').update(params.get('code_verifier')!).digest('base64url')).toBe(pending!.challenge);
      const token = await new SignJWT(pending!.claims).setProtectedHeader({ alg: 'RS256', kid: 'fixture-key' })
        .setIssuer(pending!.issuer ?? `https://login.microsoftonline.com/${tenant}/v2.0`).setAudience(pending!.audience ?? client)
        .setIssuedAt().setExpirationTime(pending!.expired ? '0s' : '5m').sign(pending!.badSignature ? wrongKey : signingKey);
      return Response.json({ id_token: token, access_token: 'fixture-access-token', token_type: 'Bearer', expires_in: 300, scope: 'openid profile email' });
    }
    throw new Error('Unexpected network request: ' + url.origin + url.pathname);
  }));
  auth = await createTestAuth();
});
beforeEach(() => { for (const rows of Object.values(state.db)) rows.length = 0; state.emails.length = 0; state.otps.length = 0; codes.clear(); exchanges = 0; });
afterAll(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

test('new PSU identity is immediately verified without sending email and keeps a stable oid binding', async () => {
  const { response, cookie } = await finish(await start());
  expect(response.headers.get('location')).toBe('/dataset?search=road');
  expect(state.db.user).toHaveLength(1); expect(state.db.account).toHaveLength(1);
  expect(state.db.user[0]).toMatchObject({ email: identity.email, emailVerified: true, role: 'user' });
  expect(state.db.account[0]).toMatchObject({ providerId: 'microsoft', accountId: identity.oid, userId: state.db.user[0].id });
  expect(state.emails).toHaveLength(0);
  const session = await request('/api/auth/get-session', undefined, cookie);
  expect((await session.json()).user).toMatchObject({ id: state.db.user[0].id, emailVerified: true });
});
test('an existing PSU-linked unverified account upgrades on login without an email or a new identity', async () => {
  await finish(await start()); const id = state.db.user[0].id;
  state.db.user[0].emailVerified = false;
  const result = await finish(await start());
  expect(result.response.headers.get('location')).toBe('/dataset?search=road');
  expect(state.db.user).toHaveLength(1); expect(state.db.user[0]).toMatchObject({ id, emailVerified: true });
  expect(state.emails).toHaveLength(0);
  const session = await request('/api/auth/get-session', undefined, result.cookie);
  expect((await session.json()).user.emailVerified).toBe(true);
});
test('password signup still requires mailbox confirmation even for a PSU email', async () => {
  const response = await request('/api/auth/sign-up/email', { email: identity.email, name: 'Password member', password: 'fixture-password-123' });
  expect(response.status).toBe(200); expect(state.db.user[0].emailVerified).toBe(false); expect(state.emails).toHaveLength(1);
  const microsoft = await finish(await start());
  expect(microsoft.response.headers.get('location')).toContain('error=account_not_linked');
  expect(state.db.user[0].emailVerified).toBe(false); expect(state.db.account.map(row => row.providerId)).toEqual(['credential']);
});
test.each([{ idp: 'live.com', acct: 1 }, { email: 'guest@external.example' }])('a guest or external email is not auto-verified even with an email_verified claim: %j', async extra => {
  await finish(await start(), { ...identity, ...extra, email_verified: true });
  expect(state.db.user[0].emailVerified).toBe(false); expect(state.emails).toHaveLength(1);
});
test('a changed Microsoft email cannot verify or rebind the old account email', async () => {
  await finish(await start()); const id = state.db.user[0].id; state.db.user[0].emailVerified = false;
  await finish(await start(), { ...identity, email: 'other@psu.ac.th' });
  expect(state.db.user[0]).toMatchObject({ id, email: identity.email, emailVerified: false });
  expect(state.emails).toHaveLength(0);
});
test('same-email sign-in cannot silently take over an existing account; explicit linking preserves its ID and role', async () => {
  const existing = await member();
  const rejected = await finish(await start());
  expect(rejected.response.headers.get('location')).toContain('error=account_not_linked');
  expect(state.db.account).toHaveLength(1);
  const linked = await finish(await start(existing.cookie, true));
  expect(linked.response.headers.get('location')).toBe('/dataset?search=road');
  expect(state.db.user).toHaveLength(1); expect(state.db.user[0]).toMatchObject({ id: existing.user.id, role: 'admin', emailVerified: true });
  expect(state.db.account.find(row => row.providerId === 'microsoft')?.userId).toBe(existing.user.id);
  const returning = await finish(await start(), { ...identity, sub: 'changed-pairwise-sub' });
  expect(returning.response.headers.get('location')).toBe('/dataset?search=road');
  expect(state.db.user).toHaveLength(1); expect(state.db.account).toHaveLength(2);
});
test('linking a different email never changes an existing account', async () => {
  const existing = await member();
  const result = await finish(await start(existing.cookie, true), { ...identity, email: 'another@psu.ac.th' });
  expect(result.response.headers.get('location')).toContain('error=email_does_not_match');
  expect(state.db.user[0].id).toBe(existing.user.id); expect(state.db.account).toHaveLength(1);
});
test.each([
  { claims: { ...identity, tid: '44444444-4444-4444-4444-444444444444' } },
  { audience: 'wrong-client' }, { issuer: 'https://invalid.example/v2.0' },
  { badSignature: true }, { expired: true },
  { claims: { ...identity, oid: '' } }, { claims: { ...identity, email: undefined } },
])('invalid tenant, audience, issuer, identity or missing email is rejected: %j', async options => {
  const result = await finish(await start(), options.claims ?? identity, options);
  expect(result.response.headers.get('location')).toContain('error=');
  expect(state.db.user).toHaveLength(0); expect(state.db.account).toHaveLength(0);
});
test('state mismatch and replay never exchange a second code', async () => {
  const flow = await start();
  const mismatch = await request('/api/auth/callback/microsoft?code=unused&state=wrong', undefined, cookies(flow.response));
  expect(mismatch.headers.get('location')).toContain('error='); expect(exchanges).toBe(0);
  const result = await finish(await start()); expect(exchanges).toBe(1);
  const replay = await request(result.path, undefined, result.cookie);
  expect(replay.headers.get('location')).toContain('error='); expect(exchanges).toBe(1);
});
test('declining Microsoft consent returns to the error page without creating an account', async () => {
  const flow = await start();
  const response = await request('/api/auth/callback/microsoft?' + new URLSearchParams({
    error: 'access_denied', state: flow.url.searchParams.get('state')!,
  }), undefined, cookies(flow.response));
  expect(response.headers.get('location')).toContain('/auth-error?callbackURL=%2Fdataset');
  expect(response.headers.get('location')).toContain('error=access_denied');
  expect(exchanges).toBe(0); expect(state.db.user).toHaveLength(0);
});
test('unverified Microsoft sessions cannot start linking another account', async () => {
  const result = await finish(await start(), { ...identity, idp: 'live.com', acct: 1 });
  const denied = await request('/api/auth/link-social', { provider: 'microsoft', callbackURL: '/account' }, result.cookie);
  expect(denied.status).toBe(403); expect((await denied.json()).code).toBe('EMAIL_NOT_VERIFIED');
});
test('Microsoft-only accounts cannot remove their last login; another user cannot unlink it', async () => {
  const result = await finish(await start());
  const row = state.db.account[0];
  const last = await request('/api/auth/unlink-account', { accountId: row.id }, result.cookie);
  expect(last.ok).toBe(false); expect(state.db.account).toHaveLength(1);
  const other = await member('other@psu.ac.th');
  const denied = await request('/api/auth/unlink-account', { accountId: row.id }, other.cookie);
  expect(denied.ok).toBe(false); expect(state.db.account.find(account => account.id === row.id)).toBeTruthy();
});
test('mailbox OTP can set a local password before unlinking Microsoft', async () => {
  const result = await finish(await start()); const id = state.db.user[0].id;
  const sent = await request('/api/auth/email-otp/request-password-reset', { email: identity.email });
  expect(sent.status).toBe(200);
  const reset = await request('/api/auth/email-otp/reset-password', {
    email: identity.email, otp: state.otps.at(-1)!.otp, password: 'new-fixture-password-123',
  });
  expect(reset.status).toBe(200);
  const local = await request('/api/auth/sign-in/email', { email: identity.email, password: 'new-fixture-password-123' });
  expect(local.status).toBe(200);
  const unlinked = await request('/api/auth/unlink-account', { accountId: state.db.account.find(row => row.providerId === 'microsoft')!.id }, cookies(local));
  expect(unlinked.status).toBe(200); expect(state.db.user[0].id).toBe(id);
  expect(state.db.account.map(row => row.providerId)).toEqual(['credential']);
  const oldSession = await request('/api/auth/get-session', undefined, result.cookie);
  expect(await oldSession.json()).toBeNull();
});
test('a banned account cannot sign back in through Microsoft', async () => {
  await finish(await start()); state.db.user[0].banned = true; state.db.user[0].banReason = 'Fixture ban';
  const denied = await finish(await start());
  expect(denied.response.headers.get('location')).toContain('error=');
});
test('link callback is rejected after the original member signs out', async () => {
  const original = await member(); const flow = await start(original.cookie, true);
  await request('/api/auth/sign-out', {}, original.cookie);
  const result = await finish(flow);
  expect(result.response.headers.get('location')).toContain('error=');
  expect(state.db.account.map(row => row.providerId)).toEqual(['credential']);
});
test('switching to a different member during linking cannot bind the original account', async () => {
  const original = await member(); const flow = await start(original.cookie, true);
  const other = await member('other@psu.ac.th');
  const result = await finish({ ...flow, cookie: other.cookie });
  expect(result.response.headers.get('location')).toContain('error=account_link_session_expired');
  expect(state.db.account.every(row => row.providerId === 'credential')).toBe(true);
});
test('a foreign origin cannot link Microsoft to a signed-in account', async () => {
  const original = await member();
  const result = await auth.handler(new Request(base + '/api/auth/link-social', { method: 'POST',
    headers: { origin: 'https://evil.example', cookie: original.cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'microsoft', callbackURL: '/account' }),
  }));
  expect(result.status).toBe(403); expect(state.db.account.map(row => row.providerId)).toEqual(['credential']);
});
