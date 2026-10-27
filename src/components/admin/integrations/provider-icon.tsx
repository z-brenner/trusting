import { Cloud, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

/** Neutral, brand-free icon tile for a storage provider. */
export function ProviderIcon({ provider, className }: { provider: "google" | "microsoft"; className?: string }) {
  const Icon = provider === "google" ? HardDrive : Cloud;
  return (
    <span
      className={cn("flex size-10 shrink-0 items-center justify-center rounded-md bg-neutral-soft text-ink-muted", className)}
      aria-hidden="true"
    >
      <Icon className="size-5" />
    </span>
  );
}

export const PROVIDER_LABELS: Record<"google" | "microsoft", string> = {
  google: "Google Drive",
  microsoft: "OneDrive",
};
