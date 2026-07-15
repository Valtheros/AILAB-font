"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function PasswordInput({ className, ...props }: React.ComponentProps<"input">) {
  const [visible, setVisible] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const selectionRef = React.useRef<[number | null, number | null]>([null, null]);

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const input = inputRef.current;
      const [start, end] = selectionRef.current;
      if (!input || start === null) return;
      input.focus({ preventScroll: true });
      input.setSelectionRange(start, end ?? start);
      selectionRef.current = [null, null];
    });
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  const captureSelection = () => {
    const input = inputRef.current;
    selectionRef.current = [input?.selectionStart ?? null, input?.selectionEnd ?? null];
  };

  const toggleVisibility = () => {
    if (selectionRef.current[0] === null) captureSelection();
    setVisible((current) => !current);
  };

  return (
    <div className="relative">
      <Input {...props} ref={inputRef} className={cn("pr-10", className)} type={visible ? "text" : "password"} />
      <button
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        disabled={props.disabled}
        onClick={toggleVisibility}
        onPointerDown={captureSelection}
        title={visible ? "Hide password" : "Show password"}
        type="button"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export { PasswordInput };
