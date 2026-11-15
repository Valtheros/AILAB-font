import { useEffect } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AuthGate } from '@/components/auth/auth-gate';
import { AuthForm } from '@/components/auth/auth-form';
import { SessionMenu } from '@/components/auth/session-menu';
import DatasetPage from '@/app/dataset/page';
import TasksPage from '@/app/tasks/page';
import AnnotationPage from '@/app/annotate/page';
import { translate } from '@/lib/i18n';

const state = vi.hoisted(() => ({
  session: null as null | { user: { id: string; email: string; emailVerified: boolean }; session: object },
  pending: false, language: 'en' as 'en' | 'th', path: '/annotate', search: '',
  router: { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() },
  signOut: vi.fn(), signup: vi.fn(), resend: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => state.router, usePathname: () => state.path, useSearchParams: () => new URLSearchParams(state.search) }));
vi.mock('@/lib/auth-client', () => ({ signOutToHome: state.signOut, authClient: {
  useSession: () => ({ data: state.session, isPending: state.pending }), signOut: state.signOut,
  signUp: { email: state.signup }, sendVerificationEmail: state.resend,
} }));
vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ language: state.language, t: (key: string) => translate(state.language, key) }) }));
vi.mock('@/components/Navbar', () => ({ Navbar: () => null }));
vi.mock('@/components/Sidebar', () => ({ Sidebar: () => null, MobileMenuButton: () => null }));
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); state.session = null; state.pending = false; state.language = 'en'; state.path = '/annotate'; state.search = '';
  state.signOut.mockResolvedValue({}); state.signup.mockResolvedValue({}); state.resend.mockResolvedValue({});
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

test.each([['/dataset', DatasetPage], ['/tasks', TasksPage], ['/annotate', AnnotationPage]] as const)('guest %s does not mount private data requests or polling', (path, Page) => {
  state.path = path; vi.useFakeTimers();
  render(<Page />);
  expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  vi.advanceTimersByTime(60000);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(state.router.replace).toHaveBeenCalledWith(`/login?callbackURL=${encodeURIComponent(path)}`);
  expect(document.querySelector('input[type=file]')).toBeNull();
});

test('pending and unverified sessions never mount the workspace; verified members do', () => {
  const mounted = vi.fn(); const unmounted = vi.fn();
  function Private() { useEffect(() => { mounted(); return unmounted; }, []); return <p>Private workspace</p>; }
  state.pending = true;
  const view = render(<AuthGate><Private /></AuthGate>);
  expect(mounted).not.toHaveBeenCalled();
  state.pending = false;
  state.session = { user: { id: 'a', email: 'a@example.invalid', emailVerified: false }, session: {} };
  view.rerender(<AuthGate><Private /></AuthGate>);
  expect(screen.getByText('Verify your email')).toBeTruthy();
  expect(mounted).not.toHaveBeenCalled();
  state.session.user.emailVerified = true;
  view.rerender(<AuthGate><Private /></AuthGate>);
  expect(mounted).toHaveBeenCalledTimes(1);
  state.session.user.id = 'b';
  view.rerender(<AuthGate><Private /></AuthGate>);
  expect(unmounted).toHaveBeenCalledTimes(1);
  expect(mounted).toHaveBeenCalledTimes(2);
  state.session = null;
  view.rerender(<AuthGate><Private /></AuthGate>);
  expect(screen.queryByText('Private workspace')).toBeNull();
  expect(state.router.replace).toHaveBeenCalledWith('/login?callbackURL=%2Fannotate');
});

test('Label Studio transfer keeps its full callback without requesting an import as a guest', () => {
  state.search = 'project=3&transfer=12345678-1234-1234-1234-123456789012';
  render(<AnnotationPage />);
  expect(state.router.replace).toHaveBeenCalledWith(`/login?callbackURL=${encodeURIComponent(`/annotate?${state.search}`)}`);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('private pages still redirect to login with the intended path', async () => {
  state.path = '/tasks/my-task'; state.search = 'tab=results';
  render(<AuthGate><p>Private workspace</p></AuthGate>);
  await waitFor(() => expect(state.router.replace).toHaveBeenCalledWith('/login?callbackURL=%2Ftasks%2Fmy-task%3Ftab%3Dresults'));
  expect(screen.queryByText('Private workspace')).toBeNull();
});

test('signup and verification preserve the transfer callback', async () => {
  const target = '/annotate?project=3&transfer=12345678-1234-1234-1234-123456789012';
  state.search = new URLSearchParams({ callbackURL: target }).toString();
  render(<AuthForm mode="signup" />);
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test user' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.invalid' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'testing-only-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
  await waitFor(() => expect(state.signup).toHaveBeenCalledWith(expect.objectContaining({ callbackURL: target })));
  fireEvent.click(await screen.findByRole('button', { name: 'Resend link' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Resend link' }).at(-1)!);
  await waitFor(() => expect(state.resend).toHaveBeenCalledWith({ email: 'test@example.invalid', callbackURL: target }));
  expect(state.router.push).not.toHaveBeenCalled();
});

test('sign out uses a full-navigation logout instead of cached router navigation', async () => {
  state.session = { user: { id: 'a', email: 'a@example.invalid', emailVerified: true }, session: {} };
  render(<SessionMenu />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(state.signOut).toHaveBeenCalled());
  expect(state.router.push).not.toHaveBeenCalled();
});
