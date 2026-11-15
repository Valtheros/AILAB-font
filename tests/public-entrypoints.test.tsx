import { beforeEach, expect, test, vi } from 'vitest';
import HomePage from '@/app/page';
import LoginPage from '@/app/login/page';
import SignupPage from '@/app/signup/page';

const state = vi.hoisted(() => ({ session: null as object | null, redirect: vi.fn() }));
vi.mock('@/lib/session', () => ({ getCurrentSession: async () => state.session }));
vi.mock('next/navigation', () => ({ redirect: state.redirect }));
vi.mock('@/app/overview/page', () => ({ default: () => null }));
vi.mock('@/components/auth/auth-page', () => ({ AuthPage: () => null }));
beforeEach(() => { state.session = null; state.redirect.mockReset().mockImplementation((path) => { throw new Error(`redirect:${path}`); }); });

test('root renders the overview when no valid session exists', async () => {
  expect(await HomePage()).toBeTruthy();
  expect(state.redirect).not.toHaveBeenCalled();
});
test('root redirects authenticated visitors to their dashboard', async () => {
  state.session = { user: { id: 'member' } };
  await expect(HomePage()).rejects.toThrow('redirect:/dashboard');
});
test.each([LoginPage, SignupPage])('auth page does not infer a valid session from cookies', async (Page) => {
  expect(await Page({ searchParams: Promise.resolve({ callbackURL: '/dataset' }) })).toBeTruthy();
  expect(state.redirect).not.toHaveBeenCalled();
});
test.each([LoginPage, SignupPage])('auth page respects a validated session and safe destination', async (Page) => {
  state.session = { user: { id: 'member' } };
  await expect(Page({ searchParams: Promise.resolve({ callbackURL: '/annotate?project=3&transfer=abc' }) })).rejects.toThrow('redirect:/annotate?project=3&transfer=abc');
  await expect(Page({ searchParams: Promise.resolve({ callbackURL: '/login' }) })).rejects.toThrow('redirect:/dashboard');
});
