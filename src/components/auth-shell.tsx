import { ShieldCheck } from "lucide-react";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="dot-grid relative flex flex-1 items-center justify-center px-4 py-12">
      <div className="relative w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex size-9 items-center justify-center rounded-lg bg-ink text-ink-inverse">
            <ShieldCheck className="size-[18px]" aria-hidden="true" />
          </div>
          <h1 className="font-display text-[32px] leading-[1.05] text-ink">{title}</h1>
          {subtitle ? <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">{subtitle}</p> : null}
        </div>
        <div className="rounded-lg border border-line bg-surface p-6 shadow-sm sm:p-7">{children}</div>
      </div>
    </main>
  );
}
