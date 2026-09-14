/**
 * @name input
 * @description A text input component for forms and user data entry with built-in styling and accessibility features.
 * @dependencies none
 * @registryDependencies use-auto-space
 * @type registry:ui
 */
import * as React from "react";

import { cn } from "@/lib/utils";

import { useAutoSpace } from "@/components/ui/use-auto-space";

/** Input types where auto-spacing must never run. */
const SKIP_TYPES = new Set([
  "email",
  "number",
  "url",
  "password",
  "search",
  "tel",
]);

function Input({
  className,
  type,
  autoSpace = false,
  ...props
}: React.ComponentProps<"input"> & {
  /**
   * When `true`, automatically inserts a space after punctuation (. , ! ? ; :)
   * when the user types the next word without one.
   * Automatically disabled for email, number, url, password, search, and tel inputs.
   */
  autoSpace?: boolean;
}) {
  const handleBeforeInput = useAutoSpace(
    autoSpace && !SKIP_TYPES.has(type ?? ""),
  );

  return (
    <input
      type={type}
      autoComplete="off"
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-2xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-placeholder-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:h-10 md:px-2.5 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      onBeforeInput={handleBeforeInput}
      {...props}
    />
  );
}

export { Input };
