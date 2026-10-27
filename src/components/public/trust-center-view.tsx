import type { Snapshot } from "@/lib/snapshot";

/**
 * STUB — replaced by the public-page implementation.
 * Contract: renders a full Trust Center from a snapshot.
 *  - mode "public": real download/request links.
 *  - mode "preview": admin preview inside an iframe; document links are inert
 *    (render as buttons/anchors with href="#" and a "Preview" hint), request-access dialog disabled.
 *  - publishedAt: shown as "Last updated"; null in preview means "not yet published".
 *  - documentLinks: map of document id -> pre-signed URL (public docs only); computed by the caller
 *    because signing is server-only.
 */
export type TrustCenterViewProps = {
  snapshot: Snapshot;
  mode: "public" | "preview";
  publishedAt: Date | null;
  documentLinks?: Record<string, string>;
};

export function TrustCenterView({ snapshot, mode, publishedAt }: TrustCenterViewProps) {
  return (
    <div className="p-8" style={{ ["--brand" as string]: snapshot.company.primaryColor }}>
      <h1 className="text-2xl font-semibold">{snapshot.company.title}</h1>
      <p className="text-sm text-ink-muted">
        {mode} · {publishedAt ? publishedAt.toISOString() : "unpublished"}
      </p>
    </div>
  );
}
