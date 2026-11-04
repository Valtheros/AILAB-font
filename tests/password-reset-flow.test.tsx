import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

const calls = vi.hoisted(() => ({ reset: vi.fn(), check: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock('@/lib/auth-client', () => ({
  authClient: { emailOtp: { resetPassword: calls.reset, checkVerificationOtp: calls.check } },
}));

beforeEach(() => {
  calls.reset.mockReset();
  calls.check.mockReset();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ accepted: true }))));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function enterCodeAndPassword() {
  render(<ForgotPasswordForm />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
  fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'auth.forgot.continue' }));
  expect(screen.getByText('auth.forgot.codeCheckedOnUpdate')).toBeTruthy();
  expect(calls.check).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewPassword123!' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'NewPassword123!' } });
}

test('password reset verifies and consumes the code only when submitted', async () => {
  calls.reset.mockResolvedValue({ data: { success: true }, error: null });
  await enterCodeAndPassword();
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
  await screen.findByText('Password updated.');
  expect(calls.reset).toHaveBeenCalledOnce();
  expect(calls.reset).toHaveBeenCalledWith({ email: 'person@example.com', otp: '123456', password: 'NewPassword123!' });
});

test('a rejected code returns to the code step without discarding the password', async () => {
  calls.reset.mockResolvedValue({ error: { code: 'INVALID_OTP', message: 'Invalid OTP' } });
  await enterCodeAndPassword();
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
  await waitFor(() => expect(screen.getByText('The code is invalid or expired.')).toBeTruthy());
  fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '654321' } });
  fireEvent.click(screen.getByRole('button', { name: 'auth.forgot.continue' }));
  expect((screen.getByLabelText('New password') as HTMLInputElement).value).toBe('NewPassword123!');
});
