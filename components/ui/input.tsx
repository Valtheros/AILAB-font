import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border border-gray-300 bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:border-gray-700 dark:file:text-gray-100 dark:placeholder:text-gray-500 dark:focus-visible:ring-gray-600",
        className
      )}
      {...props}
    />
  );
}

export { Input };
