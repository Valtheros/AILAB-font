import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { translate } from '@/lib/i18n';

const calls = vi.hoisted(() => ({ reset: vi.fn(), check: vi.fn(), language: 'en' as 'en' | 'th' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/components/language-provider', () => ({ useLanguage: () => ({ t: (key: string) => translate(calls.language, key) }) }));
vi.mock('@/lib/auth-client', () => ({
  authClient: { emailOtp: { resetPassword: calls.reset, checkVerificationOtp: calls.check } },
}));

beforeEach(() => {
  calls.language = 'en';
  calls.reset.mockReset();
  calls.check.mockReset();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ accepted: true }))));
});

test('OTP labels and validation use Thai without changing the verification flow', async () => {
  calls.language = 'th';
  render(<ForgotPasswordForm accountEmail="mine@psu.ac.th" />);
  fireEvent.click(screen.getByRole('button', { name: translate('th', 'auth.forgot.send') }));
  await screen.findByLabelText(translate('th', 'auth.forgot.code'));
  fireEvent.click(screen.getByRole('button', { name: translate('th', 'auth.forgot.continue') }));
  expect(screen.getByText(translate('th', 'auth.forgot.codeRequired'))).toBeTruthy();
  expect(calls.reset).not.toHaveBeenCalled(); expect(calls.check).not.toHaveBeenCalled();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function enterCodeAndPassword() {
  render(<ForgotPasswordForm />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
  fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText(translate('en', 'auth.forgot.codeCheckedOnUpdate'))).toBeTruthy();
  expect(calls.check).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewPassword123!' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'NewPassword123!' } });
}

test('password reset verifies and consumes the code only when submitted', async () => {
  calls.reset.mockResolvedValue({ data: { success: true }, error: null });
  await enterCodeAndPassword();
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
  await screen.findByText(translate('en', 'auth.forgot.complete'));
  expect(calls.reset).toHaveBeenCalledOnce();
  expect(calls.reset).toHaveBeenCalledWith({ email: 'person@example.com', otp: '123456', password: 'NewPassword123!' });
});

test('a rejected code returns to the code step without discarding the password', async () => {
  calls.reset.mockResolvedValue({ error: { code: 'INVALID_OTP', message: 'Invalid OTP' } });
  await enterCodeAndPassword();
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
  await waitFor(() => expect(screen.getByText('The code is invalid or expired.')).toBeTruthy());
  fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '654321' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect((screen.getByLabelText('New password') as HTMLInputElement).value).toBe('NewPassword123!');
});

test('signed-in password setup fixes the displayed email and uses the unchanged recovery API', async () => {
  calls.reset.mockResolvedValue({ data: { success: true }, error: null });
  const { container } = render(<ForgotPasswordForm accountEmail="mine@psu.ac.th" />);
  const email = screen.getByLabelText('Email') as HTMLInputElement;
  expect(email.readOnly).toBe(true);
  fireEvent.change(email, { target: { value: 'another@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
  const otp = await screen.findByLabelText('Verification code');
  expect(fetch).toHaveBeenCalledWith('/api/password-reset/email', expect.objectContaining({ body: JSON.stringify({ email: 'mine@psu.ac.th' }) }));
  expect(screen.queryByRole('button', { name: 'Use another email' })).toBeNull();
  expect(container.querySelectorAll('[data-slot="otp-digit"]')).toHaveLength(6);
  expect(otp.getAttribute('placeholder')).toBeNull();
  fireEvent.change(otp, { target: { value: '012345' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('mine@psu.ac.th');
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewPassword123!' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'NewPassword123!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
  await screen.findByText(translate('en', 'auth.password.complete'));
  expect(calls.reset).toHaveBeenCalledWith({ email: 'mine@psu.ac.th', otp: '012345', password: 'NewPassword123!' });
});
