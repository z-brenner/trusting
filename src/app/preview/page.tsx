import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { buildSnapshot } from "@/lib/snapshot";
import { TrustCenterView } from "@/components/public/trust-center-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Draft preview",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Admin-only rendering of the current draft, exactly as it would look once
 * published. Loaded inside the editor's live-preview iframe; also works as a
 * stand-alone page.
 */
export default async function PreviewPage() {
  await requireAdmin();
  const snapshot = await buildSnapshot();
  return <TrustCenterView mode="preview" snapshot={snapshot} publishedAt={null} />;
}
