import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "brand";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-ink-inverse hover:bg-accent-hover border border-transparent shadow-xs disabled:bg-accent/60",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-surface-muted hover:border-ink-faint/60 shadow-xs disabled:text-ink-faint disabled:hover:border-line-strong",
  ghost: "bg-transparent text-ink-muted hover:bg-neutral-soft hover:text-ink border border-transparent",
  danger: "bg-danger text-ink-inverse hover:brightness-95 border border-transparent shadow-xs",
  brand: "bg-[var(--brand)] text-white hover:brightness-95 border border-transparent shadow-xs",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-11 px-5 text-[15px] gap-2",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium tracking-[-0.005em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-70 select-none",
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
