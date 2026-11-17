"use client";

import { OTPInput, REGEXP_ONLY_DIGITS } from "input-otp";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function OtpInput(props: Omit<ComponentProps<typeof OTPInput>, "render" | "children" | "maxLength">) {
  return (
    <OTPInput
      {...props}
      maxLength={6}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete="one-time-code"
      pasteTransformer={(value) => value.replace(/\D/g, "")}
      containerClassName="flex w-full justify-center has-disabled:opacity-50"
      render={({ slots }) => (
        <div aria-hidden="true" className="grid w-full max-w-80 grid-cols-6 gap-1.5">
          {slots.map((slot, index) => (
            <div
              key={index}
              data-slot="otp-digit"
              className={cn(
                "relative flex h-12 min-w-0 items-center justify-center rounded-md border border-input bg-background text-xl font-medium tabular-nums",
                props["aria-invalid"] && "border-destructive",
                slot.isActive && "border-ring ring-[3px] ring-ring/30",
              )}
            >
              {slot.char}
              {slot.hasFakeCaret && <span className="absolute h-5 w-px animate-pulse bg-foreground" />}
            </div>
          ))}
        </div>
      )}
    />
  );
}
