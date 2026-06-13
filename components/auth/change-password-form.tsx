"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
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
import { useLanguage } from "@/components/language-provider";
import { Switch } from "@/components/ui/switch";
import { authClient } from "@/lib/auth-client";
import {
  changePasswordSchema,
  currentPasswordSchema,
  newPasswordSchema,
  zodFieldErrors,
} from "@/lib/auth-validation";

type ChangePasswordField = "currentPassword" | "newPassword" | "confirmPassword";
type ChangePasswordErrors = Partial<Record<ChangePasswordField, string>>;
type AuthClientError = {
  code?: string;
  message?: string;
  status?: number;
};

const fieldErrorIds: Record<ChangePasswordField, string> = {
  currentPassword: "change-password-current-error",
  newPassword: "change-password-new-error",
  confirmPassword: "change-password-confirm-error",
};

export function ChangePasswordForm() {
  const router = useRouter();
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<ChangePasswordErrors>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function setFieldError(field: ChangePasswordField, message: string) {
    setFieldErrors((current) => ({ ...current, [field]: message }));
  }

  function clearFieldError(field: ChangePasswordField) {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function validateField(field: ChangePasswordField, value: string) {
    if (field === "currentPassword") {
      const result = currentPasswordSchema.safeParse(value);
      return result.success ? "" : (result.error.issues[0]?.message ?? "");
    }

    if (field === "newPassword") {
      const result = newPasswordSchema.safeParse(value);
      if (!result.success) {
        return result.error.issues[0]?.message ?? "";
      }
      if (value && currentPassword && value === currentPassword) {
        return "New password must be different from the current password.";
      }
      return "";
    }

    if (!value) {
      return "Confirm your new password.";
    }
    if (value !== newPassword) {
      return "Passwords do not match.";
    }
    return "";
  }

  function parseForm() {
    const result = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
      revokeOtherSessions,
    });

    if (!result.success) {
      setFieldErrors(zodFieldErrors<ChangePasswordField>(result.error));
      return null;
    }

    setFieldErrors({});
    return result.data;
  }

  function showChangePasswordError(authError: AuthClientError | null | undefined) {
    const message = authError?.message || "Could not update password.";
    const lowerMessage = message.toLowerCase();
    const lowerCode = authError?.code?.toLowerCase() ?? "";

    if (
      lowerMessage.includes("invalid password") ||
      lowerCode.includes("invalid_password")
    ) {
      setFieldError("currentPassword", "Current password is incorrect.");
      return;
    }

    if (
      lowerMessage.includes("credential") ||
      lowerCode.includes("credential_account")
    ) {
      setError(
        "This account does not have an email/password login method to update."
      );
      return;
    }

    if (lowerMessage.includes("too short") || lowerMessage.includes("too long")) {
      setFieldError("newPassword", message);
      return;
    }

    setError(message);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const values = parseForm();
    if (!values) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: values.revokeOtherSessions,
      });

      if (result.error) {
        showChangePasswordError(result.error);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password updated.");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not update password."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Change password
        </CardTitle>
        <CardDescription>
          {t("auth.changePassword.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid max-w-xl gap-4" noValidate onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              aria-describedby={
                fieldErrors.currentPassword
                  ? fieldErrorIds.currentPassword
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors.currentPassword)}
              autoComplete="current-password"
              id="currentPassword"
              onBlur={(event) => {
                const message = validateField(
                  "currentPassword",
                  event.target.value
                );
                if (message) {
                  setFieldError("currentPassword", message);
                } else {
                  clearFieldError("currentPassword");
                }
              }}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                setError("");
                setSuccess("");
                clearFieldError("currentPassword");
              }}
              placeholder="Your current password"
              type="password"
              value={currentPassword}
            />
            <FieldError
              id={fieldErrorIds.currentPassword}
              message={fieldErrors.currentPassword}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              aria-describedby={
                fieldErrors.newPassword ? fieldErrorIds.newPassword : undefined
              }
              aria-invalid={Boolean(fieldErrors.newPassword)}
              autoComplete="new-password"
              id="newPassword"
              onBlur={(event) => {
                const message = validateField("newPassword", event.target.value);
                if (message) {
                  setFieldError("newPassword", message);
                } else {
                  clearFieldError("newPassword");
                }
              }}
              onChange={(event) => {
                setNewPassword(event.target.value);
                setError("");
                setSuccess("");
                clearFieldError("newPassword");
                if (confirmPassword && event.target.value === confirmPassword) {
                  clearFieldError("confirmPassword");
                }
              }}
              placeholder="At least 8 characters"
              type="password"
              value={newPassword}
            />
            <FieldError
              id={fieldErrorIds.newPassword}
              message={fieldErrors.newPassword}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              aria-describedby={
                fieldErrors.confirmPassword
                  ? fieldErrorIds.confirmPassword
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              autoComplete="new-password"
              id="confirmPassword"
              onBlur={(event) => {
                const message = validateField(
                  "confirmPassword",
                  event.target.value
                );
                if (message) {
                  setFieldError("confirmPassword", message);
                } else {
                  clearFieldError("confirmPassword");
                }
              }}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setError("");
                setSuccess("");
                clearFieldError("confirmPassword");
              }}
              placeholder="Repeat the new password"
              type="password"
              value={confirmPassword}
            />
            <FieldError
              id={fieldErrorIds.confirmPassword}
              message={fieldErrors.confirmPassword}
            />
          </div>

          <div className="flex min-h-20 items-center justify-between rounded-md border border-border bg-background/70 p-4">
            <div className="pr-4">
              <Label htmlFor="revokeOtherSessions">Sign out other sessions</Label>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t("auth.changePassword.revokeHelper")}
              </p>
            </div>
            <Switch
              checked={revokeOtherSessions}
              id="revokeOtherSessions"
              onCheckedChange={setRevokeOtherSessions}
            />
          </div>

          {success && (
            <p className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              {success}
            </p>
          )}
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
