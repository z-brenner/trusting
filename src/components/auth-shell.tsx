import { ShieldCheck } from "lucide-react";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-ink text-ink-inverse">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-ink-muted">{subtitle}</p> : null}
        </div>
        <div className="rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-8">{children}</div>
      </div>
    </main>
  );
}
