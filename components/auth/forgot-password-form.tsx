"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  KeyRound,
  Loader2,
  MailCheck,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { FieldError } from "@/components/auth/field-error";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import {
  authEmailSchema,
  forgotPasswordNewPasswordSchema,
  forgotPasswordOtpSchema,
  forgotPasswordRequestSchema,
  newPasswordSchema,
  otpCodeSchema,
  zodFieldErrors,
} from "@/lib/auth-validation";

type Step = "request" | "verify" | "password" | "complete";
type RequestField = "email";
type VerifyField = "otp";
type PasswordField = "newPassword" | "confirmPassword";
type RequestErrors = Partial<Record<RequestField, string>>;
type VerifyErrors = Partial<Record<VerifyField, string>>;
type PasswordErrors = Partial<Record<PasswordField, string>>;
type AuthClientError = {
  code?: string;
  message?: string;
  status?: number;
};

class PasswordResetCheckError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PasswordResetCheckError";
    this.status = status;
  }
}

const requestErrorIds: Record<RequestField, string> = {
  email: "forgot-password-email-error",
};

const verifyErrorIds: Record<VerifyField, string> = {
  otp: "forgot-password-otp-error",
};

const passwordErrorIds: Record<PasswordField, string> = {
  newPassword: "forgot-password-new-password-error",
  confirmPassword: "forgot-password-confirm-password-error",
};

function initialEmail(value: string | null) {
  const result = authEmailSchema.safeParse(value ?? "");
  return result.success ? result.data : "";
}

function normalizeOtp(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function isRateLimitError(error: AuthClientError | null | undefined) {
  const code = error?.code?.toLowerCase() ?? "";
  const message = error?.message?.toLowerCase() ?? "";
  return error?.status === 429 || code.includes("rate") || message.includes("rate");
}

function isOtpError(error: AuthClientError | null | undefined) {
  const code = error?.code?.toLowerCase() ?? "";
  const message = error?.message?.toLowerCase() ?? "";
  return (
    code.includes("invalid_otp") ||
    code.includes("otp_expired") ||
    code.includes("too_many_attempts") ||
    message.includes("otp") ||
    message.includes("code")
  );
}

async function requestResetEmail(email: string) {
  const response = await fetch("/api/password-reset/email", {
    body: JSON.stringify({ email }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new PasswordResetCheckError(
      errorBody?.detail || "Could not check this email right now.",
      response.status
    );
  }

  await response.json().catch(() => null);
}

export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const queryEmail = useMemo(
    () => initialEmail(searchParams.get("email")),
    [searchParams]
  );
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState(queryEmail);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requestErrors, setRequestErrors] = useState<RequestErrors>({});
  const [verifyErrors, setVerifyErrors] = useState<VerifyErrors>({});
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  function setRequestFieldError(field: RequestField, message: string) {
    setRequestErrors((current) => ({ ...current, [field]: message }));
  }

  function clearRequestFieldError(field: RequestField) {
    setRequestErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function setVerifyFieldError(field: VerifyField, message: string) {
    setVerifyErrors((current) => ({ ...current, [field]: message }));
  }

  function clearVerifyFieldError(field: VerifyField) {
    setVerifyErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function setPasswordFieldError(field: PasswordField, message: string) {
    setPasswordErrors((current) => ({ ...current, [field]: message }));
  }

  function clearPasswordFieldError(field: PasswordField) {
    setPasswordErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function validatePasswordField(field: PasswordField, value: string) {
    if (field === "newPassword") {
      const result = newPasswordSchema.safeParse(value);
      return result.success ? "" : (result.error.issues[0]?.message ?? "");
    }

    if (!value) {
      return "Confirm your new password.";
    }
    if (value !== newPassword) {
      return "Passwords do not match.";
    }
    return "";
  }

  function showVerifyError(authError: AuthClientError | null | undefined) {
    const code = authError?.code?.toLowerCase() ?? "";

    if (isRateLimitError(authError) || code.includes("too_many_attempts")) {
      setVerifyFieldError(
        "otp",
        "Too many attempts. Please request a new code and try again."
      );
      return;
    }

    if (isOtpError(authError)) {
      setVerifyFieldError("otp", "The code is invalid or expired.");
      return;
    }

    setError(authError?.message || "Could not verify the code.");
  }

  function showPasswordError(authError: AuthClientError | null | undefined) {
    const message = authError?.message || "Could not reset password.";
    const lowerMessage = message.toLowerCase();

    if (isOtpError(authError) || isRateLimitError(authError)) {
      setStep("verify");
      setNotice("");
      setVerifyFieldError("otp", "The code is invalid or expired.");
      return;
    }

    if (lowerMessage.includes("password")) {
      setPasswordFieldError("newPassword", message);
      return;
    }

    setError(message);
  }

  async function requestResetCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError("");
    setNotice("");

    const result = forgotPasswordRequestSchema.safeParse({ email });
    if (!result.success) {
      setRequestErrors(zodFieldErrors<RequestField>(result.error));
      return;
    }

    setRequestErrors({});
    setIsRequesting(true);

    try {
      await requestResetEmail(result.data.email);

      setEmail(result.data.email);
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setVerifyErrors({});
      setPasswordErrors({});
      setStep("verify");
      setNotice("If an AILAB account exists for this email, a 6-digit reset code was sent.");
    } catch (requestError) {
      if (
        requestError instanceof PasswordResetCheckError &&
        requestError.status === 429
      ) {
        setRequestFieldError("email", requestError.message);
        return;
      }

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not send a reset code."
      );
    } finally {
      setIsRequesting(false);
    }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const result = forgotPasswordOtpSchema.safeParse({ email, otp });
    if (!result.success) {
      setVerifyErrors(zodFieldErrors<VerifyField>(result.error));
      return;
    }

    setVerifyErrors({});
    setIsVerifying(true);

    try {
      const response = await authClient.emailOtp.checkVerificationOtp({
        email: result.data.email,
        otp: result.data.otp,
        type: "forget-password",
      });

      if (response.error) {
        showVerifyError(response.error);
        return;
      }

      setStep("password");
      setNotice("Code verified. Set a new password.");
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "Could not verify the code."
      );
    } finally {
      setIsVerifying(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const result = forgotPasswordNewPasswordSchema.safeParse({
      email,
      otp,
      newPassword,
      confirmPassword,
    });
    if (!result.success) {
      setPasswordErrors(zodFieldErrors<PasswordField>(result.error));
      return;
    }

    setPasswordErrors({});
    setIsResetting(true);

    try {
      const response = await authClient.emailOtp.resetPassword({
        email: result.data.email,
        otp: result.data.otp,
        password: result.data.newPassword,
      });

      if (response.error) {
        showPasswordError(response.error);
        return;
      }

      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setStep("complete");
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Could not reset password."
      );
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>
          Verify your email with a one-time code before setting a new password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {notice && (
          <div className="mb-4 rounded-md border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-200">
            <div className="flex items-start gap-3">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">{notice}</p>
                <p className="mt-1 break-all text-xs opacity-80">{email}</p>
              </div>
            </div>
          </div>
        )}
        {error && (
          <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {step === "request" && (
          <form className="grid gap-4" noValidate onSubmit={requestResetCode}>
            <div className="grid gap-2">
              <Label htmlFor="forgot-password-email">Email</Label>
              <Input
                aria-describedby={
                  requestErrors.email ? requestErrorIds.email : undefined
                }
                aria-invalid={Boolean(requestErrors.email)}
                autoComplete="email"
                id="forgot-password-email"
                onBlur={(event) => {
                  const result = authEmailSchema.safeParse(event.target.value);
                  if (!result.success) {
                    setRequestFieldError(
                      "email",
                      result.error.issues[0]?.message ?? ""
                    );
                  } else {
                    clearRequestFieldError("email");
                  }
                }}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                  clearRequestFieldError("email");
                }}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
              <FieldError
                id={requestErrorIds.email}
                message={requestErrors.email}
              />
            </div>
            <Button disabled={isRequesting} type="submit">
              {isRequesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MailCheck className="h-4 w-4" />
              )}
              Send code
            </Button>
          </form>
        )}

        {step === "verify" && (
          <form className="grid gap-4" noValidate onSubmit={verifyOtp}>
            <div className="grid gap-2">
              <Label htmlFor="forgot-password-verify-email">Email</Label>
              <Input
                id="forgot-password-verify-email"
                readOnly
                type="email"
                value={email}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="forgot-password-otp">Verification code</Label>
              <Input
                aria-describedby={
                  verifyErrors.otp ? verifyErrorIds.otp : undefined
                }
                aria-invalid={Boolean(verifyErrors.otp)}
                autoComplete="one-time-code"
                id="forgot-password-otp"
                inputMode="numeric"
                maxLength={6}
                onBlur={(event) => {
                  const result = otpCodeSchema.safeParse(event.target.value);
                  if (!result.success) {
                    setVerifyFieldError(
                      "otp",
                      result.error.issues[0]?.message ?? ""
                    );
                  } else {
                    clearVerifyFieldError("otp");
                  }
                }}
                onChange={(event) => {
                  setOtp(normalizeOtp(event.target.value));
                  setError("");
                  clearVerifyFieldError("otp");
                }}
                placeholder="000000"
                value={otp}
              />
              <FieldError id={verifyErrorIds.otp} message={verifyErrors.otp} />
            </div>
            <Button disabled={isVerifying} type="submit">
              {isVerifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Verify code
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={isRequesting}
                onClick={() => requestResetCode()}
                size="sm"
                type="button"
                variant="outline"
              >
                {isRequesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Resend code
              </Button>
              <Button
                onClick={() => {
                  setStep("request");
                  setNotice("");
                  setError("");
                  setOtp("");
                  setVerifyErrors({});
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                Use another email
              </Button>
            </div>
          </form>
        )}

        {step === "password" && (
          <form className="grid gap-4" noValidate onSubmit={resetPassword}>
            <div className="grid gap-2">
              <Label htmlFor="forgot-password-password-email">Email</Label>
              <Input
                id="forgot-password-password-email"
                readOnly
                type="email"
                value={email}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="forgot-password-new-password">New password</Label>
              <Input
                aria-describedby={
                  passwordErrors.newPassword
                    ? passwordErrorIds.newPassword
                    : undefined
                }
                aria-invalid={Boolean(passwordErrors.newPassword)}
                autoComplete="new-password"
                id="forgot-password-new-password"
                onBlur={(event) => {
                  const message = validatePasswordField(
                    "newPassword",
                    event.target.value
                  );
                  if (message) {
                    setPasswordFieldError("newPassword", message);
                  } else {
                    clearPasswordFieldError("newPassword");
                  }
                }}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setError("");
                  clearPasswordFieldError("newPassword");
                  if (
                    confirmPassword &&
                    confirmPassword === event.target.value
                  ) {
                    clearPasswordFieldError("confirmPassword");
                  }
                }}
                placeholder="At least 8 characters"
                type="password"
                value={newPassword}
              />
              <FieldError
                id={passwordErrorIds.newPassword}
                message={passwordErrors.newPassword}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="forgot-password-confirm-password">
                Confirm new password
              </Label>
              <Input
                aria-describedby={
                  passwordErrors.confirmPassword
                    ? passwordErrorIds.confirmPassword
                    : undefined
                }
                aria-invalid={Boolean(passwordErrors.confirmPassword)}
                autoComplete="new-password"
                id="forgot-password-confirm-password"
                onBlur={(event) => {
                  const message = validatePasswordField(
                    "confirmPassword",
                    event.target.value
                  );
                  if (message) {
                    setPasswordFieldError("confirmPassword", message);
                  } else {
                    clearPasswordFieldError("confirmPassword");
                  }
                }}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setError("");
                  clearPasswordFieldError("confirmPassword");
                }}
                placeholder="Repeat the new password"
                type="password"
                value={confirmPassword}
              />
              <FieldError
                id={passwordErrorIds.confirmPassword}
                message={passwordErrors.confirmPassword}
              />
            </div>
            <Button disabled={isResetting} type="submit">
              {isResetting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              Update password
            </Button>
          </form>
        )}

        {step === "complete" && (
          <div className="grid gap-4">
            <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-200">
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="font-medium">Password updated.</p>
              </div>
            </div>
            <Button asChild>
              <Link href={`/login?email=${encodeURIComponent(email)}`}>
                <ArrowRight className="h-4 w-4" />
                Sign in
              </Link>
            </Button>
          </div>
        )}

        <p className="mt-5 text-sm text-muted-foreground">
          Remember your password?{" "}
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href="/login"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
