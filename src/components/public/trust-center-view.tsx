import * as React from "react";
import { ArrowUpRight, Award, BadgeCheck, Mail, Phone, ShieldCheck } from "lucide-react";
import type { FrameworkStatus } from "@/generated/prisma/enums";
import type { Snapshot, SnapshotCertification, SnapshotContact, SnapshotDocument, SnapshotFramework } from "@/lib/snapshot";
import { FRAMEWORK_KIND_LABELS, FRAMEWORK_STATUS_LABELS, frameworkBySlug, type FrameworkKind } from "@/data/frameworks";
import { DOCUMENT_CATEGORIES, documentCategoryLabel } from "@/data/document-categories";
import { expandLocationToCountries } from "@/data/locations";
import { formatBytes, formatDate, safeHexColor, safeHttpUrl } from "@/lib/utils";
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

const STATUS_DOT: Record<FrameworkStatus, string> = {
  CERTIFIED: "bg-success",
  AUDITED: "bg-info",
  SELF_ATTESTED: "bg-ink-faint",
  IN_PROGRESS: "bg-warning",
  APPLICABLE: "bg-teal",
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
  const number = (id: string) => String(sections.findIndex((s) => s.id === id) + 1).padStart(2, "0");

  const documentById = new Map(snapshot.documents.map((d) => [d.id, d]));
  const countries = new Set(snapshot.subprocessors.flatMap((s) => s.locations.flatMap(expandLocationToCountries)));
  const certifiedOrAudited = snapshot.frameworks.filter((f) => f.status === "CERTIFIED" || f.status === "AUDITED").length;

  const stats = [
    { label: "Frameworks", value: snapshot.frameworks.length, hint: certifiedOrAudited ? `${certifiedOrAudited} independently verified` : null },
    { label: "Subprocessors", value: snapshot.subprocessors.length, hint: countries.size ? `${countries.size} ${countries.size === 1 ? "country" : "countries"} disclosed` : null },
    { label: "Documents", value: snapshot.documents.length, hint: snapshot.documents.some((d) => d.visibility === "REQUEST") ? "some on request" : null },
    { label: "Last updated", value: lastUpdated ?? "Draft", hint: null, text: true },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas text-ink" style={brandVars(primary, secondary) as React.CSSProperties}>
      {preview ? (
        <div className="bg-ink px-4 py-1.5 text-center font-mono text-[11px] font-medium tracking-[0.08em] text-ink-inverse uppercase" role="status">
          Preview of your draft — not visible to visitors
        </div>
      ) : null}

      <header className="relative overflow-hidden border-b border-line bg-surface">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-[var(--brand)]" aria-hidden="true" />
        <div className="dot-grid pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" aria-hidden="true" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {company.hasLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/api/logo" alt="" width={36} height={36} className="size-9 shrink-0 rounded-md object-contain" />
              ) : (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-ink text-ink-inverse" aria-hidden="true">
                  <ShieldCheck className="size-[18px]" />
                </span>
              )}
              {company.companyName ? <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">{company.companyName}</p> : null}
            </div>
            <div className="flex items-center gap-5">
              {website && websiteHost ? (
                <a href={website} target="_blank" rel="noopener noreferrer" className="hidden items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink sm:inline-flex">
                  {websiteHost}
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : null}
              <span className="eyebrow hidden sm:inline">{lastUpdated ? `Updated ${lastUpdated}` : "Not yet published"}</span>
            </div>
          </div>

          <div className="pt-16 pb-14 sm:pt-24 sm:pb-20">
            <p className="eyebrow flex items-center gap-2 text-ink-muted">
              <span className="inline-block size-2 rounded-full bg-[var(--brand)]" aria-hidden="true" />
              Trust Center
            </p>
            <h1 className="font-display mt-5 max-w-4xl text-[44px] leading-[1.02] text-ink sm:text-[64px] lg:text-[76px]">{company.title}</h1>
            {company.tagline ? <p className="mt-6 max-w-2xl text-lg leading-[1.55] text-ink-muted sm:text-[21px]">{company.tagline}</p> : null}
          </div>

          <dl className="grid grid-cols-2 border-t border-line lg:grid-cols-4">
            {stats.map((s, i) => (
              <div key={s.label} className={`py-5 pr-4 ${i % 2 === 1 ? "pl-4 border-l border-line" : ""} ${i >= 2 ? "border-t border-line lg:border-t-0" : ""} ${i === 2 ? "lg:border-l lg:pl-4" : ""} ${i === 3 ? "lg:pl-4" : ""}`}>
                <dt className="eyebrow">{s.label}</dt>
                <dd className={`font-display mt-2 leading-none text-ink ${s.text ? "text-[26px] sm:text-[30px]" : "text-[34px] sm:text-[40px]"}`}>{s.value}</dd>
                {s.hint ? <dd className="mt-1.5 text-[13px] text-ink-muted">{s.hint}</dd> : null}
              </div>
            ))}
          </dl>
        </div>
      </header>

      {sections.length > 0 ? <SectionNav sections={sections} /> : null}

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        {hasIntro || preview ? (
          <Section id="introduction" number={number("introduction")} title="Introduction" description="Who we are and how we approach security and privacy.">
            {hasIntro ? (
              <div className="prose-trust max-w-3xl text-[17px] leading-[1.7] text-ink">
                {paragraphs(company.description).map((p, i) => (
                  <p key={i}>
                    {p}
                  </p>
                ))}
              </div>
            ) : (
              <Placeholder>Add a description in the Company step to introduce your organisation.</Placeholder>
            )}
          </Section>
        ) : null}

        {hasFrameworks || preview ? (
          <Section
            id="compliance"
            number={number("compliance")}
            title="Compliance overview"
            description="The laws, standards and frameworks we work with, and how far along we are with each."
          >
            {hasFrameworks ? (
              <>
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {snapshot.frameworks.map((f) => (
                    <FrameworkCard key={f.id} framework={f} documents={documentById} documentLinks={documentLinks} preview={preview} />
                  ))}
                </ul>
                <p className="mt-6 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
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
            number={number("subprocessors")}
            title="Subprocessors"
            description="Third parties that process data on our behalf, the services they provide and where processing takes place."
          >
            {hasSubprocessors ? (
              <div className="space-y-12">
                <SubprocessorDirectory subprocessors={snapshot.subprocessors} />
                {company.showMap && snapshot.subprocessors.some((s) => s.locations.length > 0) ? (
                  <div>
                    <div className="mb-4 flex items-baseline justify-between gap-4">
                      <h3 className="text-[15px] font-semibold text-ink">Processing locations</h3>
                      {countries.size ? <span className="eyebrow">{countries.size} {countries.size === 1 ? "country" : "countries"}</span> : null}
                    </div>
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
          <Section id="documents" number={number("documents")} title="Documents" description="Policies, reports and certificates. Some documents are available on request.">
            {hasDocuments ? <DocumentsSection groups={groupDocuments(snapshot.documents, documentLinks)} mode={mode} /> : <Placeholder>No published documents yet.</Placeholder>}
          </Section>
        ) : null}

        {hasContacts || preview ? (
          <Section id="contacts" number={number("contacts")} title="Contacts" description="Who to reach for security, privacy and compliance questions.">
            {hasContacts ? (
              <div className="space-y-6">
                {company.contactEmail || company.contactPhone ? (
                  <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div>
                      <p className="eyebrow">Security &amp; privacy enquiries</p>
                      {company.contactNote ? <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-muted">{company.contactNote}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {company.contactEmail ? <ContactPill icon={Mail} href={`mailto:${company.contactEmail}`} label={company.contactEmail} /> : null}
                      {company.contactPhone ? <ContactPill icon={Phone} href={`tel:${company.contactPhone.replace(/[^\d+]/g, "")}`} label={company.contactPhone} /> : null}
                    </div>
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
          <Section
            id="certifications"
            number={number("certifications")}
            title="Personnel certifications"
            description="Professional qualifications held by the people responsible for security and privacy."
          >
            {hasCertifications ? (
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
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

      <footer className="mt-16 border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1.5 text-[13px] text-ink-muted">
            {company.legalName || company.companyName ? <p className="text-[15px] font-semibold text-ink">{company.legalName || company.companyName}</p> : null}
            {company.address ? <p className="whitespace-pre-line">{company.address}</p> : null}
            {company.registrationNumber ? <p>Registration {company.registrationNumber}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5 md:items-end">
            {lastUpdated ? <p className="eyebrow">Last updated {lastUpdated}</p> : null}
            <p className="eyebrow">Built with Trusting</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ---------- Sections ----------

function Section({
  id,
  number,
  title,
  description,
  children,
}: {
  id: string;
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-14 border-b border-line py-14 last:border-b-0 sm:py-20">
      <div className="mb-8 grid gap-4 sm:mb-10 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5">
          <p className="eyebrow">{number}</p>
          <h2 id={`${id}-title`} className="font-display mt-3 text-[34px] leading-[1.05] text-ink sm:text-[42px]">
            {title}
          </h2>
        </div>
        <p className="max-w-md text-[15px] leading-relaxed text-ink-muted lg:col-span-7 lg:col-start-7 lg:self-end">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line-strong px-5 py-10 text-center text-sm text-ink-muted">{children}</p>;
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
  const verified = f.status === "CERTIFIED" || f.status === "AUDITED";

  return (
    <li className="group flex min-w-0 flex-col rounded-xl border border-line bg-surface p-5 transition-colors duration-150 hover:border-line-strong sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{kindLabel}</p>
          <h3 className="mt-2 text-[22px] leading-tight font-semibold tracking-[-0.015em] text-ink">{f.shortName}</h3>
        </div>
        {verified ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand)_10%,white)] text-[var(--brand-text)]" aria-hidden="true">
            <BadgeCheck className="size-4" />
          </span>
        ) : null}
      </div>

      <p className="mt-3 inline-flex w-fit items-center gap-2 rounded-full border border-line py-1 pr-3 pl-2 text-xs font-medium text-ink" title={status.description}>
        <span className={`size-1.5 rounded-full ${STATUS_DOT[f.status] ?? "bg-ink-faint"}`} aria-hidden="true" />
        {status.label}
      </p>

      {f.name !== f.shortName ? <p className="mt-4 text-[13px] leading-relaxed text-ink-muted">{f.name}</p> : null}
      {f.note ? <p className="mt-3 text-sm leading-relaxed text-ink">{f.note}</p> : null}

      {details.length > 0 || validity ? (
        <dl className="mt-5 space-y-2 border-t border-line pt-4 text-[13px]">
          {validity ? (
            <div className="flex gap-3">
              <dt className="w-28 shrink-0 text-ink-muted">{validity.term}</dt>
              <dd className="text-ink">{validity.value}</dd>
            </div>
          ) : null}
          {details.map((d) => (
            <div key={d.term} className="flex gap-3">
              <dt className="w-28 shrink-0 text-ink-muted">{d.term}</dt>
              <dd className="text-ink">{d.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {docs.length > 0 ? (
        <div className="mt-5 border-t border-line pt-4">
          <p className="eyebrow">Evidence</p>
          <ul className="mt-2 space-y-1.5 text-[13px]">
            {docs.map((d) => {
              const href = d.visibility === "PUBLIC" && !preview ? documentLinks[d.id] : undefined;
              return (
                <li key={d.id}>
                  <a href={href ?? `#doc-${d.id}`} className="inline-flex items-center gap-1 font-medium text-[var(--brand-text)] underline-offset-[3px] hover:underline">
                    {d.title}
                    <ArrowUpRight className="size-3" aria-hidden="true" />
                  </a>
                  {!href && d.visibility === "REQUEST" ? <span className="text-ink-muted"> · on request</span> : null}
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

function ContactPill({ icon: Icon, href, label }: { icon: typeof Mail; href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink transition-colors duration-150 hover:border-line-strong hover:bg-surface-muted"
    >
      <Icon className="size-4 text-[var(--brand-text)]" aria-hidden="true" />
      <span className="break-all">{label}</span>
    </a>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function ContactCard({ contact: c }: { contact: SnapshotContact }) {
  return (
    <li className="flex min-w-0 flex-col rounded-xl border border-line bg-surface p-5 transition-colors duration-150 hover:border-line-strong sm:p-6">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="font-display flex size-11 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand)_10%,white)] text-[17px] text-[var(--brand-text)]"
          aria-hidden="true"
        >
          {initials(c.name)}
        </span>
        <div className="min-w-0">
          <p className="text-[16px] leading-snug font-semibold text-ink">{c.name}</p>
          {c.jobTitle || c.department ? <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">{[c.jobTitle, c.department].filter(Boolean).join(" · ")}</p> : null}
        </div>
      </div>
      {c.responsibilities ? <p className="mt-4 text-sm leading-relaxed text-ink-muted">{c.responsibilities}</p> : null}
      {c.email || c.phone ? (
        <div className="mt-4 flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
          {c.email ? (
            <a href={`mailto:${c.email}`} className="inline-flex items-center gap-2 text-[var(--brand-text)] underline-offset-[3px] hover:underline">
              <Mail className="size-4 shrink-0" aria-hidden="true" />
              <span className="break-all">{c.email}</span>
            </a>
          ) : null}
          {c.phone ? (
            <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-2 text-[var(--brand-text)] underline-offset-[3px] hover:underline">
              <Phone className="size-4 shrink-0" aria-hidden="true" />
              {c.phone}
            </a>
          ) : null}
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
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-5 sm:px-6">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--brand)_10%,white)] text-[var(--brand-text)]" aria-hidden="true">
          <Award className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-ink">
            {c.name}
            {c.issuer ? <span className="font-normal text-ink-muted"> · {c.issuer}</span> : null}
          </p>
          {c.holderName ? <p className="mt-0.5 text-[13px] text-ink-muted">Held by {c.holderName}</p> : null}
          {meta.length ? <p className="mt-1 font-mono text-[11px] tracking-wide text-ink-faint uppercase">{meta.join(" · ")}</p> : null}
        </div>
      </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-full border border-line bg-surface px-3.5 text-[13px] font-medium text-ink transition-colors duration-150 hover:border-line-strong hover:bg-surface-muted sm:self-center"
        >
          Verify
          <ArrowUpRight className="size-3.5 text-ink-faint" aria-hidden="true" />
          <span className="sr-only">{c.name} (opens in a new tab)</span>
        </a>
      ) : null}
    </li>
  );
}
