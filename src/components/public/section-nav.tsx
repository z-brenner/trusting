"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SectionLink = { id: string; label: string };

/**
 * Sticky in-page navigation with a light scroll-spy. Links are plain anchors so
 * the page works without JavaScript; the active state is progressive enhancement.
 */
export function SectionNav({ sections, className }: { sections: SectionLink[]; className?: string }) {
  const [active, setActive] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const elements = sections.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
          else visible.delete(entry.target.id);
        }
        if (visible.size > 0) {
          const top = Array.from(visible.entries()).sort((a, b) => a[1] - b[1])[0][0];
          setActive(top);
        }
      },
      { rootMargin: "-96px 0px -55% 0px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label="Sections" className={cn("sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur-sm", className)}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <ul className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sections.map((s) => {
            const isActive = active === s.id;
            return (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#${s.id}`}
                  aria-current={isActive ? "location" : undefined}
                  className={cn(
                    "inline-flex h-12 items-center border-b-2 px-3 text-sm transition-colors duration-150",
                    isActive
                      ? "border-[var(--brand)] font-medium text-ink"
                      : "border-transparent text-ink-muted hover:border-line-strong hover:text-ink",
                  )}
                >
                  {s.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
