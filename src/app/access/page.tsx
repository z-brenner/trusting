import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Download, FileText, Lock, ShieldCheck } from "lucide-react";
import { getPublished } from "@/lib/snapshot";
import { grantDocuments, signDownloadUrl } from "@/lib/documents/access";
import { documentCategoryLabel } from "@/data/document-categories";
import { formatBytes, formatDate, safeHexColor } from "@/lib/utils";
import { brandVars } from "@/components/public/brand";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Document access",
  robots: { index: false, follow: false },
};

const GRANT_COOKIE = "tc_grant";

/**
 * Lists the documents a visitor may download through an approved access grant.
 * The grant token lives in an httpOnly cookie set by /access/[token]; download
 * links are short-lived and re-minted on every page load.
 */
export default async function AccessPage(props: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, jar, published] = await Promise.all([props.searchParams, cookies(), getPublished()]);
  const token = jar.get(GRANT_COOKIE)?.value ?? "";
  const result = token ? await grantDocuments(token) : null;

  const company = published?.snapshot.company;
  const primary = safeHexColor(company?.primaryColor, "#1f3a5f");
  const secondary = safeHexColor(company?.secondaryColor, "#0f766e");
  const title = company?.title ?? "Trust Center";

  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas text-ink" style={brandVars(primary, secondary) as React.CSSProperties}>
      <header className="bg-[var(--brand)] text-[var(--brand-fg)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-5 sm:px-6">
          {company?.hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/api/logo" alt="" width={36} height={36} className="size-9 shrink-0 rounded-md bg-white/95 object-contain p-0.5" />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--brand-fg)]/12" aria-hidden="true">
              <ShieldCheck className="size-5" />
            </span>
          )}
          <Link href="/" className="text-[15px] font-semibold underline-offset-4 hover:underline">
            {title}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        {result ? (
          <>
            <div className="max-w-2xl">
              <p className="text-[13px] font-medium tracking-wide text-ink-muted uppercase">Document access</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
                Documents shared with {result.grant.requesterName}
              </h1>
              <p className="mt-3 text-[15px] text-ink-muted">
                Your access was approved and is valid until{" "}
                <time dateTime={result.grant.grantExpiresAt?.toISOString()}>{formatDate(result.grant.grantExpiresAt)}</time>. These documents are
                confidential and shared with you for your own assessment only.
              </p>
            </div>

            {result.documents.length === 0 ? (
              <p className="mt-8 rounded-lg border border-dashed border-line-strong px-5 py-8 text-center text-sm text-ink-muted">
                The documents covered by this grant are no longer available.
              </p>
            ) : (
              <ul className="mt-8 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {result.documents.map((doc) => (
                  <li key={doc.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-neutral-soft text-ink-muted" aria-hidden="true">
                        <FileText className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-ink">{doc.title}</p>
                        {doc.description ? <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{doc.description}</p> : null}
                        <p className="mt-1 text-xs text-ink-muted">
                          {[documentCategoryLabel(doc.category), doc.versionLabel, doc.documentDate ? `Last updated ${formatDate(doc.documentDate)}` : "", formatBytes(doc.sizeBytes)]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </div>
                    <a
                      href={signDownloadUrl(doc.id, "grant", result.grant.id)}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink shadow-xs transition-colors duration-150 hover:bg-surface-muted sm:self-center"
                    >
                      <Download className="size-3.5 text-ink-muted" aria-hidden="true" />
                      Download
                      <span className="sr-only"> {doc.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-[13px] text-ink-muted">Download links expire after a few minutes; reload this page to refresh them.</p>
          </>
        ) : (
          <div className="mx-auto max-w-md text-center">
            <span className="mx-auto mb-5 flex size-11 items-center justify-center rounded-lg bg-neutral-soft text-ink-muted" aria-hidden="true">
              <Lock className="size-5" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {status === "invalid" ? "This access link isn’t valid" : "No active document access"}
            </h1>
            <p className="mt-3 text-sm text-ink-muted">
              {status === "invalid"
                ? "The link may have expired, been revoked, or already been replaced by a newer one. If you still need these documents, submit a new request from the Trust Center."
                : "Open the link from your approval email to view the documents shared with you, or submit a request from the Trust Center."}
            </p>
            <p className="mt-8">
              <Link
                href="/"
                className="inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink shadow-xs transition-colors duration-150 hover:bg-surface-muted"
              >
                Back to the Trust Center
              </Link>
            </p>
          </div>
        )}
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-6 text-[13px] text-ink-muted sm:px-6">
          {company?.legalName || company?.companyName ? <span>{company.legalName || company.companyName} · </span> : null}Built with Trusting
        </div>
      </footer>
    </div>
  );
}
