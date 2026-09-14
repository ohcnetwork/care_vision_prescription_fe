/**
 * @name button
 * @description Displays a button or a component that looks like a button.
 * @dependencies @base-ui/react class-variance-authority
 * @type registry:ui
 */
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "touch-action-manipulation group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent bg-clip-padding px-3 text-sm font-semibold tracking-wide whitespace-nowrap outline-0 transition select-none [-webkit-tap-highlight-color:transparent] not-in-data-[slot=button-group]:rounded-squircle-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:pointer-events-none disabled:opacity-50 aria-invalid:outline-2 aria-invalid:outline-offset-2 aria-invalid:outline-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default:
          "border-primary-950/90 bg-primary text-primary-foreground shadow-md shadow-primary/50 text-shadow-primary-950/75 text-shadow-xs not-disabled:inset-shadow-2xs not-disabled:inset-shadow-primary-200/30 hover:bg-primary/90 dark:border-primary-900 dark:shadow-background dark:text-shadow-primary-200/50 dark:not-disabled:inset-shadow-2xs dark:not-disabled:inset-shadow-primary-200/80 [:active,[data-pressed]]:bg-primary/80 [:active,[data-pressed]]:inset-shadow-sm [:active,[data-pressed]]:inset-shadow-primary-800 dark:[:active,[data-pressed]]:inset-shadow-sm dark:[:active,[data-pressed]]:inset-shadow-primary-800 [:disabled,:active,[data-pressed]]:shadow-none",
        secondary:
          "border border-primary-700 bg-background text-primary-900 shadow-md hover:border-primary-600 hover:bg-primary-700/10 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground dark:text-primary-500 [:active,[data-pressed]]:bg-primary-700/5 [:active,[data-pressed]]:inset-shadow-sm [:active,[data-pressed]]:inset-shadow-neutral-500/35 dark:[:active,[data-pressed]]:inset-shadow-neutral-950 [:disabled,:active,[data-pressed]]:shadow-none",
        tertiary:
          "bg-muted-background/70 underline underline-offset-4 hover:border-border hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted [:active,[data-pressed]]:bg-muted/90 [:active,[data-pressed]]:inset-shadow-sm [:active,[data-pressed]]:inset-shadow-neutral-400/40 dark:[:active,[data-pressed]]:inset-shadow-neutral-950/80",
        outline:
          "border-border border-stronger-border bg-background shadow-md hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50 [:active,[data-pressed]]:bg-muted/80 [:active,[data-pressed]]:inset-shadow-sm [:active,[data-pressed]]:inset-shadow-neutral-400/50 dark:[:active,[data-pressed]]:inset-shadow-neutral-950/80 [:disabled,:active,[data-pressed]]:shadow-none",
        ghost:
          "underline underline-offset-4 hover:bg-strong-background/75 hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted [:active,[data-pressed]]:bg-muted/90",
        link: "text-blue-700 underline underline-offset-4 transition-[color,text-underline-offset] hover:text-blue-800 hover:underline-offset-2 dark:text-blue-400 dark:hover:text-blue-300 [:active,[data-pressed]]:text-blue-900 dark:[:active,[data-pressed]]:text-blue-200",
        destructive:
          "border border-destructive/70 bg-red-100/75 text-red-700 shadow-md hover:bg-destructive/20 focus-visible:outline-destructive dark:bg-destructive/5 dark:text-red-400 dark:hover:border-destructive/75 dark:hover:bg-destructive/4 [:active,[data-pressed]]:bg-destructive/25 [:active,[data-pressed]]:inset-shadow-sm [:active,[data-pressed]]:inset-shadow-red-400/40 dark:[:active,[data-pressed]]:bg-destructive/5 dark:[:active,[data-pressed]]:inset-shadow-neutral-950 [:disabled,:active,[data-pressed]]:shadow-none",
        "destructive-solid":
          "border border-red-700 bg-destructive text-white shadow-md text-shadow-red-950/75 text-shadow-xs hover:bg-destructive/80 focus-visible:outline-destructive dark:bg-red-500/90 dark:text-shadow-red-900 dark:hover:bg-red-500/80 [:active,[data-pressed]]:bg-destructive/70 [:active,[data-pressed]]:inset-shadow-sm [:active,[data-pressed]]:inset-shadow-destructive/90 dark:[:active,[data-pressed]]:bg-red-500/70 dark:[:active,[data-pressed]]:inset-shadow-red-950/90 [:disabled,:active,[data-pressed]]:shadow-none",
      },
      size: {
        default:
          "h-12 px-4.5 in-data-[slot=button-group]:rounded-[min(var(--radius-md),10px)] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 md:h-10 md:px-3.5 [&_svg]:stroke-[1.75] [&_svg:not([class*='size-'])]:size-5",
        xs: "h-8 gap-1 rounded-[min(var(--radius-md),8px)] px-2.5 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 md:h-8 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 gap-1.5 rounded-[min(var(--radius-md),10px)] px-3 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 md:h-9 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-11 gap-1.5 px-4 text-base in-data-[slot=button-group]:rounded-[min(var(--radius-md),10px)] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 md:h-11 [&_svg]:stroke-[1.75] [&_svg:not([class*='size-'])]:size-5",
        xl: "h-12 gap-2 px-4.5 text-base in-data-[slot=button-group]:rounded-[min(var(--radius-md),12px)] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4 md:h-12 [&_svg:not([class*='size-'])]:size-5",
        icon: "size-12 md:size-10 [&_svg]:stroke-[1.75] [&_svg:not([class*='size-'])]:size-5",
        "icon-xs":
          "size-8 rounded-[min(var(--radius-md),8px)] in-data-[slot=button-group]:rounded-md md:size-8 [&_svg]:stroke-2 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm":
          "size-9 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-md md:size-9 [&_svg]:stroke-2 [&_svg:not([class*='size-'])]:size-4",
        "icon-lg":
          "size-11 in-data-[slot=button-group]:rounded-[min(var(--radius-md),10px)] md:size-11 [&_svg]:stroke-[1.75] [&_svg:not([class*='size-'])]:size-5",
        "icon-xl":
          "size-12 in-data-[slot=button-group]:rounded-[min(var(--radius-md),12px)] md:size-12 [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type RenderProp =
  | React.ReactElement
  | ((props: unknown, state: unknown) => React.ReactElement)
  | undefined;

function resolveAsChild(
  asChild: boolean | undefined,
  children: React.ReactNode,
  render: RenderProp,
): {
  render: RenderProp;
  children: React.ReactNode;
  /** True when the resolved child is a plain non-button DOM tag (e.g. `<a>`). */
  isNonButtonTag: boolean;
} {
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{
      children?: React.ReactNode;
      [key: string]: unknown;
    }>;
    const { children: extractedChildren, ...restProps } = child.props;
    return {
      render: React.createElement(child.type as React.ElementType, restProps),
      children: extractedChildren,
      isNonButtonTag: typeof child.type === "string" && child.type !== "button",
    };
  }
  return { render, children, isNonButtonTag: false };
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild,
  render,
  nativeButton,
  children,
  ...props
}: Omit<ButtonPrimitive.Props, "render"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    render?: RenderProp;
  }) {
  const resolved = resolveAsChild(asChild, children, render);

  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      render={resolved.render}
      nativeButton={nativeButton ?? !resolved.isNonButtonTag}
      {...props}
    >
      {resolved.children}
    </ButtonPrimitive>
  );
}

export { Button, buttonVariants };
