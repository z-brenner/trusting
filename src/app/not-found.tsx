import Link from "next/link";

export const metadata = { title: "Page not found", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <p className="text-[13px] font-medium tracking-wide text-ink-muted uppercase">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Page not found</h1>
        <p className="mt-3 text-sm text-ink-muted">The page you are looking for doesn’t exist or has moved.</p>
        <p className="mt-8">
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink shadow-xs transition-colors duration-150 hover:bg-surface-muted"
          >
            Back to the Trust Center
          </Link>
        </p>
      </div>
    </main>
  );
}
