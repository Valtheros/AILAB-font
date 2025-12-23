"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-gray-900 data-[state=unchecked]:bg-gray-300 dark:data-[state=checked]:bg-white dark:data-[state=unchecked]:bg-gray-700 inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent shadow-xs transition-all outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-white dark:bg-gray-900 pointer-events-none block size-4 rounded-full ring-0 shadow-lg transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 dark:data-[state=checked]:bg-gray-900"
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
