import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getPublished } from "@/lib/snapshot";
import { signDownloadUrl } from "@/lib/documents/access";
import { TrustCenterView } from "@/components/public/trust-center-view";

export const dynamic = "force-dynamic";

function firstSentence(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  const m = clean.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : clean).trim().slice(0, 300);
}

export async function generateMetadata(): Promise<Metadata> {
  const published = await getPublished();
  if (!published) {
    return { title: { absolute: "Trust Center" }, robots: { index: false, follow: false } };
  }
  const { company } = published.snapshot;
  const description = company.tagline || firstSentence(company.description) || `Security and compliance information from ${company.companyName || "our organisation"}.`;
  return {
    title: { absolute: company.title },
    description,
    openGraph: {
      title: company.title,
      description,
      type: "website",
      siteName: company.companyName || company.title,
      ...(company.hasLogo ? { images: [{ url: "/api/logo" }] } : {}),
    },
    robots: { index: true, follow: true },
  };
}

export default async function PublicTrustCenterPage() {
  const published = await getPublished();

  if (!published) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="max-w-md text-center">
          <span className="mx-auto mb-5 flex size-11 items-center justify-center rounded-lg bg-neutral-soft text-ink-muted" aria-hidden="true">
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">This Trust Center hasn’t been published yet.</h1>
          <p className="mt-3 text-sm text-ink-muted">Please check back later.</p>
          <p className="mt-8 text-[13px] text-ink-muted">
            <Link href="/login" className="underline-offset-2 hover:text-ink hover:underline">
              Administrator sign in
            </Link>
          </p>
        </div>
      </main>
    );
  }

  const { snapshot, publishedAt } = published;
  const documentLinks: Record<string, string> = {};
  for (const doc of snapshot.documents) {
    if (doc.visibility !== "PUBLIC") continue;
    if (doc.allowDownload) documentLinks[doc.id] = signDownloadUrl(doc.id, "public");
    else if (doc.mimeType === "application/pdf") documentLinks[doc.id] = signDownloadUrl(doc.id, "public", undefined, true);
  }

  return <TrustCenterView mode="public" snapshot={snapshot} publishedAt={publishedAt} documentLinks={documentLinks} />;
}
