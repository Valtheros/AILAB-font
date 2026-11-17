import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AuthForm } from '@/components/auth/auth-form';
import { LoginMethods } from '@/components/auth/login-methods';
import AuthErrorPage from '@/app/auth-error/page';
import { translate } from '@/lib/i18n';

const state = vi.hoisted(() => ({ language: 'en' as 'en' | 'th', search: '', social: vi.fn(), link: vi.fn(), unlink: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: state.refresh }), useSearchParams: () => new URLSearchParams(state.search) }));
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { social: state.social }, linkSocial: state.link, unlinkAccount: state.unlink } }));
vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ language: state.language, t: (key: string) => translate(state.language, key) }) }));
beforeEach(() => { vi.clearAllMocks(); state.language = 'en'; state.search = ''; state.social.mockResolvedValue({}); state.link.mockResolvedValue({}); state.unlink.mockResolvedValue({}); });
afterEach(cleanup);

test('unconfigured Microsoft is hidden without affecting the original login form', () => {
  render(<AuthForm mode="login" />);
  expect(screen.queryByRole('button', { name: /Microsoft/ })).toBeNull();
  expect(screen.getByLabelText('Email')).toBeTruthy(); expect(screen.getByLabelText('Password')).toBeTruthy();
});
test.each(['login', 'signup'] as const)('Microsoft %s preserves the intended app URL', async mode => {
  const target = '/apps/owner/model?job=abc'; state.search = new URLSearchParams({ callbackURL: target }).toString();
  render(<AuthForm mode={mode} microsoftEnabled />);
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Microsoft (PSU)' }));
  await waitFor(() => expect(state.social).toHaveBeenCalledWith({ provider: 'microsoft', callbackURL: target, errorCallbackURL: '/auth-error?callbackURL=' + encodeURIComponent(target) }));
});
test('Microsoft rejects external return URLs and shows a translated connection error', async () => {
  state.search = 'callbackURL=https://evil.example'; state.language = 'th'; state.social.mockRejectedValue(new Error('connection lost'));
  render(<AuthForm mode="login" microsoftEnabled />);
  fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบด้วย Microsoft (PSU)' }));
  expect(await screen.findByText(translate('th', 'auth.microsoft.failed'))).toBeTruthy();
  expect(state.social).toHaveBeenCalledWith(expect.objectContaining({ callbackURL: '/dashboard' }));
});
test('existing member explicitly links from Account', async () => {
  render(<LoginMethods microsoftEnabled microsoftAccountId={null} hasPassword />);
  fireEvent.click(screen.getByRole('button', { name: 'Link Microsoft' }));
  await waitFor(() => expect(state.link).toHaveBeenCalledWith({ provider: 'microsoft', callbackURL: '/account', errorCallbackURL: '/auth-error?callbackURL=%2Faccount' }));
});
test('unlink requires confirmation and targets the account row ID', async () => {
  render(<LoginMethods microsoftEnabled microsoftAccountId="local-account-id" hasPassword />);
  fireEvent.click(screen.getByRole('button', { name: 'Unlink' }));
  expect(state.unlink).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(state.unlink).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Unlink' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Unlink' }).at(-1)!);
  await waitFor(() => expect(state.unlink).toHaveBeenCalledWith({ accountId: 'local-account-id' }));
  expect(state.refresh).toHaveBeenCalled();
});
test('Microsoft-only members keep their last sign-in method and can set a password', () => {
  render(<LoginMethods microsoftEnabled microsoftAccountId="account" hasPassword={false} />);
  expect(screen.queryByRole('button', { name: 'Unlink' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Set an AILAB password' }).getAttribute('href')).toBe('/account/password');
});
test('link failure remains visible without changing methods', async () => {
  state.link.mockResolvedValue({ error: { code: 'session_expired' } });
  render(<LoginMethods microsoftEnabled microsoftAccountId={null} hasPassword />);
  fireEvent.click(screen.getByRole('button', { name: 'Link Microsoft' }));
  expect(await screen.findByRole('alert')).toBeTruthy(); expect(state.refresh).not.toHaveBeenCalled();
});
test.each(['account_not_linked', 'email_not_found', 'invalid_organization', 'email_does_not_match'])('OAuth error %s has an actionable Thai explanation', async error => {
  state.language = 'th';
  render(await AuthErrorPage({ searchParams: Promise.resolve({ error, callbackURL: '/apps/owner/model' }) }));
  expect(screen.getByText('เข้าสู่ระบบไม่สำเร็จ')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'ลองใหม่' }).getAttribute('href')).toBe('/login?callbackURL=%2Fapps%2Fowner%2Fmodel');
  expect(screen.getByText(error)).toBeTruthy();
  if (error === 'account_not_linked') expect(screen.getByRole('link', { name: 'เข้าสู่ระบบเพื่อเชื่อมบัญชี' }).getAttribute('href')).toBe('/login?callbackURL=%2Faccount');
});
