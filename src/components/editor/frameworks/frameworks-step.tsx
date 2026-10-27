"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ExternalLink, Search } from "lucide-react";
import type { DocumentCategory, DocumentVisibility, FrameworkStatus } from "@/generated/prisma/enums";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, FormSection } from "@/components/ui/field";
import { Checkbox, Input, Select, Textarea, inputClasses } from "@/components/ui/input";
import { FRAMEWORKS, FRAMEWORK_KIND_LABELS, FRAMEWORK_STATUS_LABELS, frameworkBySlug, type Framework } from "@/data/frameworks";
import { documentCategoryLabel, visibilityLabel } from "@/data/document-categories";
import { addFrameworkAction, removeFrameworkAction, saveFrameworkAction } from "@/lib/actions/editor";
import { cn, toDateInputValue } from "@/lib/utils";
import { StepBody } from "../step-body";
import { StepFooter } from "../step-footer";
import { useTrackedAction, useWizard } from "../wizard-context";

export type FrameworkEntryRow = {
  id: string;
  frameworkSlug: string;
  status: FrameworkStatus;
  note: string;
  details: Record<string, string>;
  validFrom: Date | null;
  validUntil: Date | null;
  documentIds: string[];
};

export type DocumentOption = { id: string; title: string; category: DocumentCategory; visibility: DocumentVisibility };

type Draft = {
  frameworkSlug: string;
  status: FrameworkStatus;
  note: string;
  details: Record<string, string>;
  validFrom: string;
  validUntil: string;
  documentIds: string[];
};

function toDraft(row: FrameworkEntryRow): Draft {
  return {
    frameworkSlug: row.frameworkSlug,
    status: row.status,
    note: row.note,
    details: row.details ?? {},
    validFrom: toDateInputValue(row.validFrom),
    validUntil: toDateInputValue(row.validUntil),
    documentIds: row.documentIds,
  };
}

const sameDraft = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

export function FrameworksStep({ entries, documents }: { entries: FrameworkEntryRow[]; documents: DocumentOption[] }) {
  const router = useRouter();
  const track = useTrackedAction();
  const { registerBeforeContinue } = useWizard();
  const [query, setQuery] = React.useState("");
  // Server state is the source of truth; local edits are kept per framework until saved.
  const serverDrafts = React.useMemo(() => Object.fromEntries(entries.map((e) => [e.frameworkSlug, toDraft(e)])), [entries]);
  const [edits, setEdits] = React.useState<Record<string, Draft>>({});
  const drafts = React.useMemo(() => {
    const out: Record<string, Draft> = {};
    for (const slug of Object.keys(serverDrafts)) out[slug] = edits[slug] ?? serverDrafts[slug];
    return out;
  }, [serverDrafts, edits]);
  const [errors, setErrors] = React.useState<Record<string, Record<string, string>>>({});
  const [savingSlug, setSavingSlug] = React.useState<string | null>(null);
  const [savedSlugs, setSavedSlugs] = React.useState<Set<string>>(new Set());
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [, startTransition] = React.useTransition();
  const setOpen = (slug: string, open: boolean) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(slug);
      else next.delete(slug);
      return next;
    });

  const isDirty = (slug: string) => Boolean(edits[slug]) && Boolean(serverDrafts[slug]) && !sameDraft(edits[slug], serverDrafts[slug]);
  const clearEdit = (slug: string) =>
    setEdits((e) => {
      if (!(slug in e)) return e;
      const next = { ...e };
      delete next[slug];
      return next;
    });

  const selectedSlugs = React.useMemo(() => new Set(entries.map((e) => e.frameworkSlug)), [entries]);
  const [optimistic, applyChange] = React.useOptimistic(selectedSlugs, (state: Set<string>, change: { slug: string; selected: boolean }) => {
    const next = new Set(state);
    if (change.selected) next.add(change.slug);
    else next.delete(change.slug);
    return next;
  });

  const toggle = (def: Framework, selected: boolean) => {
    setOpen(def.slug, selected);
    startTransition(async () => {
      applyChange({ slug: def.slug, selected });
      const result = await track<{ ok: boolean }>(() => (selected ? addFrameworkAction(def.slug) : removeFrameworkAction(def.slug)));
      if (result.ok) {
        if (!selected) clearEdit(def.slug);
        router.refresh();
      }
    });
  };

  const update = (slug: string, patch: Partial<Draft>) => {
    setSavedSlugs((s) => {
      if (!s.has(slug)) return s;
      const n = new Set(s);
      n.delete(slug);
      return n;
    });
    setEdits((e) => ({ ...e, [slug]: { ...(e[slug] ?? serverDrafts[slug]), ...patch } }));
  };

  const save = React.useCallback(
    async (slug: string, draft: Draft): Promise<boolean> => {
      setSavingSlug(slug);
      try {
        const result = await track(() => saveFrameworkAction(draft));
        if (result.ok) {
          clearEdit(slug);
          setErrors((e) => ({ ...e, [slug]: {} }));
          setSavedSlugs((s) => new Set(s).add(slug));
          router.refresh();
          return true;
        }
        setErrors((e) => ({ ...e, [slug]: result.errors ?? { _: result.message ?? "Could not save." } }));
        return false;
      } finally {
        setSavingSlug(null);
      }
    },
    [track, router],
  );

  // Continue saves every entry with unsaved edits first.
  React.useEffect(() => {
    registerBeforeContinue(async () => {
      const dirty = Object.keys(edits).filter((slug) => serverDrafts[slug] && !sameDraft(edits[slug], serverDrafts[slug]));
      const results = await Promise.all(dirty.map((slug) => save(slug, edits[slug])));
      return results.every(Boolean);
    });
    return () => registerBeforeContinue(null);
  }, [registerBeforeContinue, save, edits, serverDrafts]);

  const catalog = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FRAMEWORKS;
    return FRAMEWORKS.filter(
      (f) => f.name.toLowerCase().includes(q) || f.shortName.toLowerCase().includes(q) || f.region.toLowerCase().includes(q) || FRAMEWORK_KIND_LABELS[f.kind].toLowerCase().includes(q),
    );
  }, [query]);

  const selected = entries.map((e) => ({ entry: e, def: frameworkBySlug(e.frameworkSlug) })).filter((x) => x.def && drafts[x.entry.frameworkSlug]);

  return (
    <StepBody>
      <Alert tone="info" title="Selecting a framework does not claim certification.">
        Choose the status that is true for you. Visitors always see the status next to the framework name.
      </Alert>

      <FormSection title="Choose what applies to you" description="Laws you must comply with, standards you follow and reports you have obtained.">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search frameworks, e.g. ISO, SOC 2, GDPR"
            aria-label="Search frameworks"
            className={cn(inputClasses, "h-9 pl-8")}
          />
        </div>
        <ul className="max-h-[24rem] divide-y divide-line overflow-y-auto rounded-lg border border-line bg-surface">
          {catalog.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-ink-muted">No frameworks match “{query}”.</li>
          ) : (
            catalog.map((f) => {
              const checked = optimistic.has(f.slug);
              return (
                <li key={f.slug}>
                  <label className={cn("flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-muted", checked && "bg-accent-soft/50 hover:bg-accent-soft/70")}>
                    <Checkbox className="mt-0.5" checked={checked} onChange={(e) => toggle(f, e.target.checked)} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-medium text-ink">{f.shortName}</span>
                        <Badge>{FRAMEWORK_KIND_LABELS[f.kind]}</Badge>
                        <span className="text-xs text-ink-faint">{f.region}</span>
                      </span>
                      <span className="mt-0.5 block text-[13px] text-ink-muted">{f.name}</span>
                    </span>
                  </label>
                </li>
              );
            })
          )}
        </ul>
        <p className="text-[13px] text-ink-muted">Unticking a framework removes its status, notes and linked documents.</p>
      </FormSection>

      <FormSection title="Your frameworks" description={selected.length ? "Set the status and details for each one." : "Nothing selected yet."}>
        {selected.length === 0 ? (
          <EmptyState title="No frameworks selected" description="Tick the laws, standards and reports above that apply to your organisation." />
        ) : (
          <div className="space-y-5">
            {selected.map(({ entry, def }) => {
              const slug = entry.frameworkSlug;
              const draft = drafts[slug];
              const err = errors[slug] ?? {};
              const dirty = isDirty(slug);
              const saving = savingSlug === slug;
              const d = def!;
              const open = expanded.has(slug) || dirty;
              const panelId = `fw-${slug}-panel`;
              return (
                <Card key={slug}>
                  <CardHeader
                    eyebrow={false}
                    className={cn("py-4", !open && "border-b-0")}
                    title={
                      <span className="flex flex-wrap items-center gap-2">
                        {d.shortName}
                        <Badge tone={draft.status === "CERTIFIED" || draft.status === "AUDITED" ? "success" : draft.status === "IN_PROGRESS" ? "warning" : "info"}>
                          {FRAMEWORK_STATUS_LABELS[draft.status].label}
                        </Badge>
                        {dirty ? <span className="text-xs text-ink-faint">Unsaved</span> : null}
                      </span>
                    }
                    description={d.name}
                    action={
                      <div className="flex items-center gap-1">
                        <a href={d.officialUrl} target="_blank" rel="noreferrer" className="hidden items-center gap-1 px-2 text-[13px] text-ink-muted hover:text-ink sm:inline-flex">
                          Official page <ExternalLink className="size-3.5" aria-hidden="true" />
                        </a>
                        <Button variant="ghost" size="sm" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(slug, !open)} disabled={dirty && open}>
                          {open ? "Hide details" : "Edit details"}
                          <ChevronDown className={cn("size-3.5 transition-transform duration-150", open && "rotate-180")} aria-hidden="true" />
                        </Button>
                      </div>
                    }
                  />
                  {open ? (
                  <CardBody id={panelId} className="space-y-5">
                    {err._ ? (
                      <p className="text-sm text-danger" role="alert">
                        {err._}
                      </p>
                    ) : null}
                    <Field label="Status" htmlFor={`fw-${slug}-status`} error={err.status} help={FRAMEWORK_STATUS_LABELS[draft.status]?.description}>
                      <Select id={`fw-${slug}-status`} value={draft.status} onChange={(e) => update(slug, { status: e.target.value as FrameworkStatus })}>
                        {d.allowedStatuses.map((s) => (
                          <option key={s} value={s}>
                            {FRAMEWORK_STATUS_LABELS[s].label}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    {d.detailFields?.length ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {d.detailFields.map((df) => {
                          const id = `fw-${slug}-${df.key}`;
                          const value = draft.details[df.key] ?? "";
                          return (
                            <Field key={df.key} label={df.label} htmlFor={id} optional help={df.help} error={err[`details.${df.key}`]}>
                              {df.type === "select" ? (
                                <Select id={id} value={value} onChange={(e) => update(slug, { details: { ...draft.details, [df.key]: e.target.value } })}>
                                  <option value="">Not specified</option>
                                  {df.options?.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </Select>
                              ) : (
                                <Input id={id} value={value} onChange={(e) => update(slug, { details: { ...draft.details, [df.key]: e.target.value } })} />
                              )}
                            </Field>
                          );
                        })}
                      </div>
                    ) : null}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Valid from" htmlFor={`fw-${slug}-from`} optional error={err.validFrom} help="Certificate or report date.">
                        <Input id={`fw-${slug}-from`} type="date" value={draft.validFrom} onChange={(e) => update(slug, { validFrom: e.target.value })} />
                      </Field>
                      <Field label="Valid until" htmlFor={`fw-${slug}-until`} optional error={err.validUntil}>
                        <Input id={`fw-${slug}-until`} type="date" value={draft.validUntil} onChange={(e) => update(slug, { validUntil: e.target.value })} />
                      </Field>
                    </div>

                    <Field label="Note" htmlFor={`fw-${slug}-note`} optional error={err.note} help="Scope, exclusions or anything visitors should know.">
                      <Textarea id={`fw-${slug}-note`} rows={2} className="min-h-0" value={draft.note} onChange={(e) => update(slug, { note: e.target.value })} />
                    </Field>

                    <fieldset className="min-w-0">
                      <legend className="text-sm font-medium text-ink">Supporting documents</legend>
                      {documents.length === 0 ? (
                        <p className="mt-1 text-[13px] text-ink-muted">No documents yet. Add certificates and reports in step 5, then link them here.</p>
                      ) : (
                        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-md border border-line">
                          {documents.map((doc) => {
                            const checked = draft.documentIds.includes(doc.id);
                            return (
                              <li key={doc.id}>
                                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-surface-muted">
                                  <Checkbox
                                    checked={checked}
                                    onChange={(e) =>
                                      update(slug, {
                                        documentIds: e.target.checked ? [...draft.documentIds, doc.id] : draft.documentIds.filter((x) => x !== doc.id),
                                      })
                                    }
                                  />
                                  <span className="min-w-0 flex-1 truncate text-ink">{doc.title}</span>
                                  <span className="hidden text-xs text-ink-faint sm:inline">{documentCategoryLabel(doc.category)}</span>
                                  <Badge tone={doc.visibility === "PRIVATE" ? "neutral" : doc.visibility === "REQUEST" ? "info" : "success"}>{visibilityLabel(doc.visibility)}</Badge>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {err.documentIds ? (
                        <p className="mt-1.5 text-[13px] text-danger" role="alert">
                          {err.documentIds}
                        </p>
                      ) : null}
                    </fieldset>

                    <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
                      {dirty ? (
                        <span className="text-[13px] text-ink-muted">Unsaved changes</span>
                      ) : savedSlugs.has(slug) ? (
                        <span className="inline-flex items-center gap-1 text-[13px] text-success">
                          <Check className="size-3.5" aria-hidden="true" /> Saved
                        </span>
                      ) : null}
                      <Button size="sm" variant={dirty ? "primary" : "secondary"} loading={saving} disabled={!dirty} onClick={() => save(slug, draft)}>
                        Save
                      </Button>
                    </div>
                  </CardBody>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </FormSection>

      <StepFooter />
    </StepBody>
  );
}
