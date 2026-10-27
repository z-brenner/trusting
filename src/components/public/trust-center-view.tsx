import * as React from "react";
import { Award, BadgeCheck, ExternalLink, Globe, Mail, Phone, ShieldCheck } from "lucide-react";
import type { FrameworkStatus } from "@/generated/prisma/enums";
import type { Snapshot, SnapshotCertification, SnapshotContact, SnapshotDocument, SnapshotFramework } from "@/lib/snapshot";
import { FRAMEWORK_KIND_LABELS, FRAMEWORK_STATUS_LABELS, frameworkBySlug, type FrameworkKind } from "@/data/frameworks";
import { DOCUMENT_CATEGORIES, documentCategoryLabel } from "@/data/document-categories";
import { formatBytes, formatDate, safeHexColor, safeHttpUrl } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/ui/card";
import { brandVars } from "./brand";
import { SectionNav, type SectionLink } from "./section-nav";
import { SubprocessorDirectory } from "./subprocessor-directory";
import { SubprocessorMap } from "./subprocessor-map";
import { DocumentsSection, type DocumentGroup, type DocumentRow } from "./documents-section";

/**
 * Renders a full Trust Center from a published (or draft) snapshot.
 *  - mode "public": real download links and a working access-request dialog.
 *  - mode "preview": identical layout; document actions are inert and a thin bar
 *    reminds the administrator that this is the draft.
 *  - documentLinks: document id -> pre-signed URL for PUBLIC documents, computed by
 *    the caller because signing is server-only.
 */
export type TrustCenterViewProps = {
  snapshot: Snapshot;
  mode: "public" | "preview";
  publishedAt: Date | null;
  documentLinks?: Record<string, string>;
};

const STATUS_TONES: Record<FrameworkStatus, BadgeTone> = {
  CERTIFIED: "success",
  AUDITED: "info",
  SELF_ATTESTED: "neutral",
  IN_PROGRESS: "warning",
  APPLICABLE: "teal",
};

export function TrustCenterView({ snapshot, mode, publishedAt, documentLinks = {} }: TrustCenterViewProps) {
  const { company } = snapshot;
  const primary = safeHexColor(company.primaryColor, "#1f3a5f");
  const secondary = safeHexColor(company.secondaryColor, "#0f766e");
  const preview = mode === "preview";
  const lastUpdated = publishedAt ? formatDate(publishedAt) : null;
  const website = safeHttpUrl(company.websiteUrl);
  const websiteHost = website ? new URL(website).host.replace(/^www\./, "") : null;

  const hasIntro = company.description.trim().length > 0;
  const hasFrameworks = snapshot.frameworks.length > 0;
  const hasSubprocessors = snapshot.subprocessors.length > 0;
  const hasDocuments = snapshot.documents.length > 0;
  const hasContacts = snapshot.contacts.length > 0 || Boolean(company.contactEmail || company.contactPhone);
  const hasCertifications = snapshot.certifications.length > 0;

  const sections: SectionLink[] = [
    hasIntro || preview ? { id: "introduction", label: "Introduction" } : null,
    hasFrameworks || preview ? { id: "compliance", label: "Compliance" } : null,
    hasSubprocessors || preview ? { id: "subprocessors", label: "Subprocessors" } : null,
    hasDocuments || preview ? { id: "documents", label: "Documents" } : null,
    hasContacts || preview ? { id: "contacts", label: "Contacts" } : null,
    hasCertifications || preview ? { id: "certifications", label: "Certifications" } : null,
  ].filter((s): s is SectionLink => s !== null);

  const documentById = new Map(snapshot.documents.map((d) => [d.id, d]));

  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas text-ink" style={brandVars(primary, secondary) as React.CSSProperties}>
      {preview ? (
        <div className="bg-ink px-4 py-1.5 text-center text-xs font-medium text-ink-inverse" role="status">
          Preview of your draft — not visible to visitors
        </div>
      ) : null}

      <header className="bg-[var(--brand)] text-[var(--brand-fg)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
          <div className="flex items-center gap-4">
            {company.hasLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/api/logo" alt="" width={48} height={48} className="size-12 shrink-0 rounded-md bg-white/95 object-contain p-1" />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-[var(--brand-fg)]/12" aria-hidden="true">
                <ShieldCheck className="size-6" />
              </span>
            )}
            {company.companyName ? <p className="text-sm font-medium opacity-90">{company.companyName}</p> : null}
          </div>
          <div className="max-w-3xl">
            <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[40px]">{company.title}</h1>
            {company.tagline ? <p className="mt-4 text-lg leading-relaxed opacity-90">{company.tagline}</p> : null}
          </div>
          <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm opacity-85">
            <div className="flex items-center gap-2">
              <dt className="sr-only">Last updated</dt>
              <dd>{lastUpdated ? `Last updated ${lastUpdated}` : "Not yet published"}</dd>
            </div>
            {website && websiteHost ? (
              <div className="flex items-center gap-2">
                <dt className="sr-only">Website</dt>
                <dd>
                  <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline">
                    <Globe className="size-4" aria-hidden="true" />
                    {websiteHost}
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </dd>
              </div>
            ) : null}
            {company.industry ? (
              <div className="flex items-center gap-2">
                <dt className="sr-only">Industry</dt>
                <dd>{company.industry}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </header>

      {sections.length > 0 ? <SectionNav sections={sections} /> : null}

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        {hasIntro || preview ? (
          <Section id="introduction" title="Introduction" description="Who we are and how we approach security and privacy.">
            {hasIntro ? (
              <div className="prose-trust max-w-3xl text-[15px] leading-[1.65] text-ink">
                {paragraphs(company.description).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            ) : (
              <Placeholder>Add a description in the Company step to introduce your organisation.</Placeholder>
            )}
          </Section>
        ) : null}

        {hasFrameworks || preview ? (
          <Section id="compliance" title="Compliance overview" description="The laws, standards and frameworks we work with, and how far along we are with each.">
            {hasFrameworks ? (
              <>
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {snapshot.frameworks.map((f) => (
                    <FrameworkCard key={f.id} framework={f} documents={documentById} documentLinks={documentLinks} preview={preview} />
                  ))}
                </ul>
                <p className="mt-5 text-[13px] text-ink-muted">
                  Statuses are self-reported by the organisation except where marked Certified or Independently audited.
                </p>
              </>
            ) : (
              <Placeholder>No frameworks added yet.</Placeholder>
            )}
          </Section>
        ) : null}

        {hasSubprocessors || preview ? (
          <Section
            id="subprocessors"
            title="Subprocessors"
            description="Third parties that process data on our behalf, the services they provide and where processing takes place."
          >
            {hasSubprocessors ? (
              <div className="space-y-10">
                <SubprocessorDirectory subprocessors={snapshot.subprocessors} />
                {company.showMap && snapshot.subprocessors.some((s) => s.locations.length > 0) ? (
                  <div>
                    <h3 className="mb-3 text-[15px] font-semibold text-ink">Processing locations</h3>
                    <SubprocessorMap subprocessors={snapshot.subprocessors} brandColor={primary} />
                  </div>
                ) : null}
              </div>
            ) : (
              <Placeholder>No subprocessors added yet.</Placeholder>
            )}
          </Section>
        ) : null}

        {hasDocuments || preview ? (
          <Section id="documents" title="Documents" description="Policies, reports and certificates. Some documents are available on request.">
            {hasDocuments ? <DocumentsSection groups={groupDocuments(snapshot.documents, documentLinks)} mode={mode} /> : <Placeholder>No published documents yet.</Placeholder>}
          </Section>
        ) : null}

        {hasContacts || preview ? (
          <Section id="contacts" title="Contacts" description="Who to reach for security, privacy and compliance questions.">
            {hasContacts ? (
              <div className="space-y-6">
                {company.contactEmail || company.contactPhone ? (
                  <div className="rounded-lg border border-line bg-surface px-5 py-4">
                    <p className="text-sm font-medium text-ink">Security &amp; privacy enquiries</p>
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
                      {company.contactEmail ? <ContactLine icon={Mail} href={`mailto:${company.contactEmail}`} label={company.contactEmail} /> : null}
                      {company.contactPhone ? <ContactLine icon={Phone} href={`tel:${company.contactPhone.replace(/[^\d+]/g, "")}`} label={company.contactPhone} /> : null}
                    </div>
                    {company.contactNote ? <p className="mt-2 text-[13px] text-ink-muted">{company.contactNote}</p> : null}
                  </div>
                ) : null}
                {snapshot.contacts.length > 0 ? (
                  <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {snapshot.contacts.map((c) => (
                      <ContactCard key={c.id} contact={c} />
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <Placeholder>No published contacts yet.</Placeholder>
            )}
          </Section>
        ) : null}

        {hasCertifications || preview ? (
          <Section id="certifications" title="Personnel certifications" description="Professional qualifications held by the people responsible for security and privacy.">
            {hasCertifications ? (
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {snapshot.certifications.map((c) => (
                  <CertificationRow key={c.id} cert={c} />
                ))}
              </ul>
            ) : (
              <Placeholder>No published certifications yet.</Placeholder>
            )}
          </Section>
        ) : null}
      </main>

      <footer className="mt-8 border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-[13px] text-ink-muted sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            {company.legalName || company.companyName ? <p className="font-medium text-ink">{company.legalName || company.companyName}</p> : null}
            {company.address ? <p className="whitespace-pre-line">{company.address}</p> : null}
            {company.registrationNumber ? <p>Registration: {company.registrationNumber}</p> : null}
          </div>
          <div className="space-y-1 md:text-right">
            {lastUpdated ? <p>Last updated {lastUpdated}</p> : null}
            <p className="text-ink-muted">Built with Trusting</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ---------- Sections ----------

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-16 border-b border-line py-12 last:border-b-0 sm:py-14">
      <div className="mb-6 max-w-3xl">
        <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {title}
        </h2>
        <p className="mt-1.5 text-[15px] text-ink-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line-strong px-5 py-8 text-center text-sm text-ink-muted">{children}</p>;
}

export function paragraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// ---------- Compliance ----------

function FrameworkCard({
  framework: f,
  documents,
  documentLinks,
  preview,
}: {
  framework: SnapshotFramework;
  documents: Map<string, SnapshotDocument>;
  documentLinks: Record<string, string>;
  preview: boolean;
}) {
  const status = FRAMEWORK_STATUS_LABELS[f.status] ?? { label: f.status, description: "" };
  const kindLabel = FRAMEWORK_KIND_LABELS[f.kind as FrameworkKind] ?? f.kind;
  const details = humanizeDetails(f);
  const validity = validityLabel(f.validFrom, f.validUntil);
  const docs = f.documentIds.map((id) => documents.get(id)).filter((d): d is SnapshotDocument => Boolean(d));

  return (
    <li className="flex flex-col rounded-lg border border-line bg-surface p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[17px] font-semibold text-ink">{f.shortName}</h3>
          <p className="mt-0.5 truncate text-[13px] text-ink-muted" title={f.name !== f.shortName ? f.name : undefined}>
            {kindLabel}
          </p>
        </div>
        <Badge tone={STATUS_TONES[f.status] ?? "neutral"} title={status.description} className="mt-0.5 shrink-0">
          {f.status === "CERTIFIED" ? <BadgeCheck className="size-3.5" aria-hidden="true" /> : null}
          {status.label}
        </Badge>
      </div>

      {f.name !== f.shortName ? <p className="mt-3 text-sm text-ink-muted">{f.name}</p> : null}
      {f.note ? <p className="mt-3 text-sm leading-relaxed text-ink">{f.note}</p> : null}

      {details.length > 0 || validity ? (
        <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-[13px]">
          {validity ? (
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-ink-muted">{validity.term}</dt>
              <dd className="text-ink">{validity.value}</dd>
            </div>
          ) : null}
          {details.map((d) => (
            <div key={d.term} className="flex gap-2">
              <dt className="w-32 shrink-0 text-ink-muted">{d.term}</dt>
              <dd className="text-ink">{d.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {docs.length > 0 ? (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">Evidence</p>
          <ul className="mt-1.5 space-y-1 text-[13px]">
            {docs.map((d) => {
              const href = d.visibility === "PUBLIC" && !preview ? documentLinks[d.id] : undefined;
              return (
                <li key={d.id}>
                  {href ? (
                    <a href={href} className="font-medium text-[var(--brand-text)] underline-offset-2 hover:underline">
                      {d.title}
                    </a>
                  ) : (
                    <a href={`#doc-${d.id}`} className="font-medium text-[var(--brand-text)] underline-offset-2 hover:underline">
                      {d.title}
                      {d.visibility === "REQUEST" ? <span className="font-normal text-ink-muted"> · on request</span> : null}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

function validityLabel(from: string | null, until: string | null): { term: string; value: string } | null {
  const a = from ? formatDate(from) : "";
  const b = until ? formatDate(until) : "";
  if (a && b) return { term: "Valid", value: `${a} – ${b}` };
  if (b) return { term: "Valid until", value: b };
  if (a) return { term: "Since", value: a };
  return null;
}

/** Turn stored detail keys/values into labelled, human-readable pairs using the framework catalog. */
function humanizeDetails(f: SnapshotFramework): { term: string; value: string }[] {
  if (!f.details) return [];
  const def = frameworkBySlug(f.slug);
  const out: { term: string; value: string }[] = [];
  for (const [key, raw] of Object.entries(f.details)) {
    const value = String(raw ?? "").trim();
    if (!value) continue;
    const field = def?.detailFields?.find((d) => d.key === key);
    const term = field?.label ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
    const option = field?.options?.find((o) => o.value === value);
    out.push({ term, value: option?.label ?? value });
  }
  return out;
}

// ---------- Documents ----------

function groupDocuments(documents: SnapshotDocument[], documentLinks: Record<string, string>): DocumentGroup[] {
  const order = DOCUMENT_CATEGORIES.map((c) => c.value);
  const groups = new Map<string, DocumentRow[]>();
  for (const d of documents) {
    const row: DocumentRow = {
      id: d.id,
      title: d.title,
      description: d.description,
      categoryLabel: documentCategoryLabel(d.category),
      visibility: d.visibility,
      versionLabel: d.versionLabel,
      dateLabel: formatDate(d.documentDate ?? d.updatedAt),
      sizeLabel: d.sizeBytes > 0 ? formatBytes(d.sizeBytes) : "",
      action: documentAction(d, documentLinks[d.id]),
    };
    const list = groups.get(d.category) ?? [];
    list.push(row);
    groups.set(d.category, list);
  }
  return order
    .filter((c) => groups.has(c))
    .map((c) => ({ category: c, label: documentCategoryLabel(c), documents: groups.get(c)! }));
}

function documentAction(d: SnapshotDocument, href: string | undefined): DocumentRow["action"] {
  if (d.visibility !== "PUBLIC") return null;
  if (d.allowDownload) return { kind: "download", href: href ?? null };
  // Download disabled: PDFs can still be opened inline; other types have no safe inline mode.
  if (d.mimeType === "application/pdf") return { kind: "open", href: href ?? null };
  return { kind: "unavailable" };
}

// ---------- Contacts & certifications ----------

function ContactLine({ icon: Icon, href, label }: { icon: typeof Mail; href: string; label: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-1.5 text-[var(--brand-text)] underline-offset-2 hover:underline">
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="break-all">{label}</span>
    </a>
  );
}

function ContactCard({ contact: c }: { contact: SnapshotContact }) {
  return (
    <li className="rounded-lg border border-line bg-surface p-5 shadow-xs">
      <p className="text-[15px] font-semibold text-ink">{c.name}</p>
      {c.jobTitle || c.department ? (
        <p className="mt-0.5 text-[13px] text-ink-muted">{[c.jobTitle, c.department].filter(Boolean).join(" · ")}</p>
      ) : null}
      {c.responsibilities ? <p className="mt-3 text-sm leading-relaxed text-ink">{c.responsibilities}</p> : null}
      {c.email || c.phone ? (
        <div className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3 text-sm">
          {c.email ? <ContactLine icon={Mail} href={`mailto:${c.email}`} label={c.email} /> : null}
          {c.phone ? <ContactLine icon={Phone} href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} label={c.phone} /> : null}
        </div>
      ) : null}
    </li>
  );
}

function CertificationRow({ cert: c }: { cert: SnapshotCertification }) {
  const url = safeHttpUrl(c.verificationUrl);
  const issued = c.issuedAt ? formatDate(c.issuedAt) : "";
  const expires = c.expiresAt ? formatDate(c.expiresAt) : "";
  const meta = [issued ? `Issued ${issued}` : "", expires ? `Expires ${expires}` : "", c.credentialId ? `ID ${c.credentialId}` : ""].filter(Boolean);
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-neutral-soft text-ink-muted" aria-hidden="true">
          <Award className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-ink">
            {c.name}
            {c.issuer ? <span className="font-normal text-ink-muted"> · {c.issuer}</span> : null}
          </p>
          {c.holderName ? <p className="mt-0.5 text-[13px] text-ink-muted">Held by {c.holderName}</p> : null}
          {meta.length ? <p className="mt-1 text-xs text-ink-muted">{meta.join(" · ")}</p> : null}
        </div>
      </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink transition-colors duration-150 hover:bg-surface-muted sm:self-center"
        >
          Verify
          <ExternalLink className="size-3.5 text-ink-faint" aria-hidden="true" />
          <span className="sr-only">{c.name} (opens in a new tab)</span>
        </a>
      ) : null}
    </li>
  );
}
