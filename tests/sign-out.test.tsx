import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { signOutToHome } from '@/lib/auth-client';

const state = vi.hoisted(() => ({ signOut: vi.fn(), assign: vi.fn() }));
vi.mock('better-auth/react', () => ({ createAuthClient: () => ({ signOut: state.signOut }) }));
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('window', { location: { assign: state.assign } }); });
afterEach(() => vi.unstubAllGlobals());

test('successful sign-out loads a fresh public root after the session is removed', async () => {
  state.signOut.mockResolvedValue({ error: null });
  await signOutToHome();
  expect(state.signOut).toHaveBeenCalledOnce();
  expect(state.assign).toHaveBeenCalledWith('/');
});

test('failed sign-out does not pretend the session was removed', async () => {
  const error = { message: 'Service unavailable' };
  state.signOut.mockResolvedValue({ error });
  expect(await signOutToHome()).toEqual({ error });
  expect(state.assign).not.toHaveBeenCalled();
});
