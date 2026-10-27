import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Wrapper for a wizard step: stacks form sections with generous spacing and a
 * hairline between consecutive sections.
 */
export function StepBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("space-y-10 [&>section+section]:border-t [&>section+section]:border-line [&>section+section]:pt-10", className)}
      {...props}
    />
  );
}
