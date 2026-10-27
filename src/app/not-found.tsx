import Link from "next/link";

export const metadata = { title: "Page not found", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <p className="eyebrow">404</p>
        <h1 className="font-display mt-3 text-[40px] leading-[1.05] text-ink">Page not found</h1>
        <p className="mt-3 text-sm text-ink-muted">The page you are looking for doesn’t exist or has moved.</p>
        <p className="mt-8">
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors duration-150 hover:border-line-strong hover:bg-surface-muted"
          >
            Back to the Trust Center
          </Link>
        </p>
      </div>
    </main>
  );
}
