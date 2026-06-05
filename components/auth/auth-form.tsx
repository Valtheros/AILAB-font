"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, Loader2, MailCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldError } from "@/components/auth/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import {
  authEmailSchema,
  authNameSchema,
  authPasswordSchema,
  loginSchema,
  signupSchema,
  zodFieldErrors,
  type LoginValues,
  type SignupValues,
} from "@/lib/auth-validation";

type AuthMode = "login" | "signup";
type AuthClientError = {
  code?: string;
  message?: string;
  status?: number;
};
type FieldName = "name" | "email" | "password";
type FieldErrors = Partial<Record<FieldName, string>>;

function safeCallbackURL(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}

function isEmailNotVerifiedError(error: AuthClientError | null | undefined) {
  if (!error) {
    return false;
  }
  const code = error.code?.toLowerCase() ?? "";
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.status === 403 ||
    code.includes("email_not_verified") ||
    message.includes("email not verified") ||
    message.includes("verify your email")
  );
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackURL = useMemo(
    () => safeCallbackURL(searchParams.get("callbackURL")),
    [searchParams]
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const isSignup = mode === "signup";
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
  const signupAwaitingVerification = isSignup && Boolean(verificationEmail);
  const fieldErrorIds: Record<FieldName, string> = {
    name: `${mode}-name-error`,
    email: `${mode}-email-error`,
    password: `${mode}-password-error`,
  };

  function validateField(field: FieldName, value: string) {
    const schema =
      field === "name"
        ? authNameSchema
        : field === "email"
          ? authEmailSchema
          : authPasswordSchema;
    const result = schema.safeParse(value);
    return result.success ? "" : (result.error.issues[0]?.message ?? "");
  }

  function setFieldError(field: FieldName, message: string) {
    setFieldErrors((current) => ({ ...current, [field]: message }));
  }

  function clearFieldError(field: FieldName) {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function parseAuthForm(): LoginValues | SignupValues | null {
    const result = isSignup
      ? signupSchema.safeParse({ email, name, password })
      : loginSchema.safeParse({ email, password });

    if (!result.success) {
      setFieldErrors(zodFieldErrors<FieldName>(result.error));
      return null;
    }

    setFieldErrors({});
    return result.data;
  }

  function showAuthError(authError: AuthClientError | null | undefined) {
    const message = authError?.message || "Authentication failed.";
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("invalid email or password")) {
      setFieldError("password", message);
      return;
    }

    if (lowerMessage.includes("password")) {
      setFieldError("password", message);
      return;
    }

    if (
      lowerMessage.includes("email") ||
      lowerMessage.includes("user") ||
      lowerMessage.includes("account")
    ) {
      setFieldError("email", message);
      return;
    }

    setError(message);
  }

  async function signInWithGoogle() {
    setError("");
    setFieldErrors({});
    setIsGoogleSubmitting(true);

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL,
      });
      if (result.error) {
        setError(result.error.message || "Google authentication failed.");
      }
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "Google authentication failed."
      );
    } finally {
      setIsGoogleSubmitting(false);
    }
  }

  async function resendVerificationEmail(
    targetEmail = verificationEmail || email
  ) {
    const parsedEmail = authEmailSchema.safeParse(targetEmail);
    if (!parsedEmail.success) {
      setFieldError(
        "email",
        parsedEmail.error.issues[0]?.message ?? "Enter a valid email address."
      );
      return;
    }
    setError("");
    clearFieldError("email");
    setIsResendingVerification(true);

    try {
      const result = await authClient.sendVerificationEmail({
        email: parsedEmail.data,
        callbackURL,
      });

      if (result.error) {
        setError(result.error.message || "Could not send verification email.");
        return;
      }

      setVerificationEmail(parsedEmail.data);
      setVerificationMessage(
        "We sent a fresh verification link. Check your inbox."
      );
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "Could not send verification email."
      );
    } finally {
      setIsResendingVerification(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setVerificationMessage("");

    const values = parseAuthForm();
    if (!values) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = isSignup
        ? await authClient.signUp.email({
            email: (values as SignupValues).email,
            name: (values as SignupValues).name,
            password: (values as SignupValues).password,
            callbackURL,
          })
        : await authClient.signIn.email({
            email: (values as LoginValues).email,
            password: (values as LoginValues).password,
            callbackURL,
            rememberMe: true,
          });

      if (result.error) {
        if (!isSignup && isEmailNotVerifiedError(result.error)) {
          setVerificationEmail((values as LoginValues).email);
          setVerificationMessage(
            "This email still needs verification. We sent another link if the account exists."
          );
          setPassword("");
          clearFieldError("password");
          return;
        }
        showAuthError(result.error);
        return;
      }

      if (isSignup) {
        setVerificationEmail((values as SignupValues).email);
        setVerificationMessage(
          "Check your inbox for a verification link before signing in."
        );
        setPassword("");
        return;
      }

      router.push(callbackURL);
      router.refresh();
    } catch (authError) {
      setError(
        authError instanceof Error ? authError.message : "Authentication failed."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{isSignup ? "Create account" : "Sign in"}</CardTitle>
        <CardDescription>
          {isSignup
            ? "Create a workspace identity for datasets, runs, logs, and artifacts."
            : "Open your training workspace and reconnect to previous work."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {googleEnabled && (
          <Button
            className="mb-4 w-full"
            disabled={isGoogleSubmitting || isSubmitting}
            onClick={signInWithGoogle}
            type="button"
            variant="outline"
          >
            {isGoogleSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="flex h-4 w-4 items-center justify-center rounded-sm border border-border text-xs font-semibold">
                G
              </span>
            )}
            Continue with Google
          </Button>
        )}
        {verificationMessage && (
          <div className="mb-4 rounded-md border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-200">
            <div className="flex items-start gap-3">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{verificationMessage}</p>
                {verificationEmail && (
                  <p className="mt-1 break-all text-xs opacity-80">
                    {verificationEmail}
                  </p>
                )}
              </div>
            </div>
            {verificationEmail && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  disabled={isResendingVerification}
                  onClick={() => resendVerificationEmail()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {isResendingVerification ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Resend link
                </Button>
                {signupAwaitingVerification && (
                  <Button
                    onClick={() => {
                      setVerificationEmail("");
                      setVerificationMessage("");
                      setError("");
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Use another email
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
        {error && (
          <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {!signupAwaitingVerification && (
          <form className="grid gap-4" noValidate onSubmit={onSubmit}>
            {isSignup && (
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  aria-describedby={
                    fieldErrors.name ? fieldErrorIds.name : undefined
                  }
                  aria-invalid={Boolean(fieldErrors.name)}
                  autoComplete="name"
                  id="name"
                  minLength={2}
                  onBlur={(event) => {
                    const message = validateField("name", event.target.value);
                    if (message) {
                      setFieldError("name", message);
                    } else {
                      clearFieldError("name");
                    }
                  }}
                  onChange={(event) => {
                    setName(event.target.value);
                    setError("");
                    clearFieldError("name");
                  }}
                  placeholder="Your name"
                  required
                  value={name}
                />
                <FieldError id={fieldErrorIds.name} message={fieldErrors.name} />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                aria-describedby={
                  fieldErrors.email ? fieldErrorIds.email : undefined
                }
                aria-invalid={Boolean(fieldErrors.email)}
                autoComplete="email"
                id="email"
                onBlur={(event) => {
                  const message = validateField("email", event.target.value);
                  if (message) {
                    setFieldError("email", message);
                  } else {
                    clearFieldError("email");
                  }
                }}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                  clearFieldError("email");
                  setVerificationEmail("");
                  setVerificationMessage("");
                }}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
              <FieldError id={fieldErrorIds.email} message={fieldErrors.email} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                aria-describedby={
                  fieldErrors.password ? fieldErrorIds.password : undefined
                }
                aria-invalid={Boolean(fieldErrors.password)}
                autoComplete={isSignup ? "new-password" : "current-password"}
                id="password"
                minLength={8}
                onBlur={(event) => {
                  const message = validateField("password", event.target.value);
                  if (message) {
                    setFieldError("password", message);
                  } else {
                    clearFieldError("password");
                  }
                }}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                  clearFieldError("password");
                }}
                placeholder="At least 8 characters"
                required
                type="password"
                value={password}
              />
              <FieldError
                id={fieldErrorIds.password}
                message={fieldErrors.password}
              />
            </div>
            {!isSignup && (
              <div className="-mt-2 flex justify-end">
                <Link
                  className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                  href={`/forgot-password?email=${encodeURIComponent(email)}`}
                >
                  Forgot password?
                </Link>
              </div>
            )}
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {isSignup ? "Create account" : "Sign in"}
            </Button>
          </form>
        )}
        <p className="mt-5 text-sm text-muted-foreground">
          {isSignup ? "Already have an account?" : "New to AILAB?"}{" "}
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href={`${isSignup ? "/login" : "/signup"}?callbackURL=${encodeURIComponent(callbackURL)}`}
          >
            {isSignup ? "Sign in" : "Create one"}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
