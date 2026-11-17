import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import AccountPasswordPage from '@/app/account/password/page';
import ForgotPasswordPage from '@/app/forgot-password/page';

const state = vi.hoisted(() => ({ session: vi.fn(), form: vi.fn() }));
vi.mock('@/lib/session', () => ({ getCurrentSession: state.session }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error('Redirect:' + path); } }));
vi.mock('@/components/MainLayout', () => ({ MainLayout: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/auth/forgot-password-form', () => ({ ForgotPasswordForm: (props: unknown) => { state.form(props); return <div>Recovery form</div>; } }));
vi.mock('@/components/i18n-text', () => ({ I18nText: ({ textKey }: { textKey: string }) => textKey }));
vi.mock('@/components/language-toggle', () => ({ LanguageToggle: () => null }));
vi.mock('@/components/theme-toggle', () => ({ ThemeToggle: () => null }));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

test('anonymous recovery stays available without a signed-in account', async () => {
  state.session.mockResolvedValueOnce(null);
  render(await ForgotPasswordPage());
  expect(screen.getByText('Recovery form')).toBeTruthy();
  expect(state.form.mock.calls[0][0]).not.toHaveProperty('accountEmail');
});
test('signed-in recovery goes to account-bound setup rather than accepting another email', async () => {
  state.session.mockResolvedValueOnce({ user: { id: 'mine', email: 'mine@psu.ac.th' } });
  await expect(ForgotPasswordPage()).rejects.toThrow('Redirect:/account/password');
  expect(state.form).not.toHaveBeenCalled();
});
test('private setup requires sign-in and keeps its return URL', async () => {
  state.session.mockResolvedValueOnce(null);
  await expect(AccountPasswordPage()).rejects.toThrow('Redirect:/login?callbackURL=%2Faccount%2Fpassword');
});
test('private setup passes only the current server identity to the form', async () => {
  state.session.mockResolvedValueOnce({ user: { id: 'mine', email: 'mine@psu.ac.th', name: 'PSU member' } });
  render(await AccountPasswordPage());
  expect(state.form.mock.calls[0][0]).toMatchObject({ accountEmail: 'mine@psu.ac.th' });
  expect(screen.getByRole('link').getAttribute('href')).toBe('/account');
});
