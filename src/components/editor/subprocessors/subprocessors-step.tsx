"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ExternalLink, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { Subprocessor } from "@/generated/prisma/client";
import { Badge, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/ui/field";
import { Checkbox, Select, inputClasses } from "@/components/ui/input";
import { SubprocessorMap } from "@/components/public/subprocessor-map";
import { VENDORS, VENDOR_CATEGORIES, searchVendors, type Vendor } from "@/data/vendors";
import { locationName } from "@/data/locations";
import { dataCategoryLabel } from "@/data/data-categories";
import type { SnapshotSubprocessor } from "@/lib/snapshot";
import { addVendorSubprocessorAction, deleteSubprocessorAction, removeVendorSubprocessorAction } from "@/lib/actions/editor";
import { cn, safeHttpUrl } from "@/lib/utils";
import { ConfirmButton } from "../confirm-button";
import { StepBody } from "../step-body";
import { StepFooter } from "../step-footer";
import { useTrackedAction } from "../wizard-context";
import { SubprocessorDialog } from "./subprocessor-dialog";

type OptimisticChange = { slug: string; selected: boolean };

export function SubprocessorsStep({ subprocessors, primaryColor }: { subprocessors: Subprocessor[]; primaryColor: string }) {
  const router = useRouter();
  const track = useTrackedAction();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");
  const [dialog, setDialog] = React.useState<{ open: boolean; row: Subprocessor | null }>({ open: false, row: null });
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  const selectedSlugs = React.useMemo(
    () => new Set(subprocessors.map((s) => s.vendorSlug).filter((s): s is string => Boolean(s))),
    [subprocessors],
  );
  const [optimisticSelected, applyChange] = React.useOptimistic(selectedSlugs, (state: Set<string>, change: OptimisticChange) => {
    const next = new Set(state);
    if (change.selected) next.add(change.slug);
    else next.delete(change.slug);
    return next;
  });

  const toggleVendor = (vendor: Vendor, selected: boolean) => {
    startTransition(async () => {
      applyChange({ slug: vendor.slug, selected });
      const result = await track<{ ok: boolean }>(() =>
        selected ? addVendorSubprocessorAction(vendor.slug) : removeVendorSubprocessorAction(vendor.slug),
      );
      if (result.ok) router.refresh();
    });
  };

  const remove = async (row: Subprocessor) => {
    setBusyId(row.id);
    try {
      const result = await track(() => deleteSubprocessorAction(row.id));
      if (result.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const visibleVendors = React.useMemo(() => {
    const base = searchVendors(query);
    return category === "all" ? base : base.filter((v) => v.category === category);
  }, [query, category]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, Vendor[]>();
    for (const v of visibleVendors) {
      const list = map.get(v.category) ?? [];
      list.push(v);
      map.set(v.category, list);
    }
    return Array.from(map.entries());
  }, [visibleVendors]);

  const mapRows: SnapshotSubprocessor[] = subprocessors.map((s) => ({
    id: s.id,
    vendorSlug: s.vendorSlug,
    name: s.name,
    websiteUrl: s.websiteUrl,
    privacyPolicyUrl: s.privacyPolicyUrl,
    services: s.services,
    locations: s.locations,
    dataCategories: s.dataCategories,
    notes: s.notes,
  }));
  const missingLocations = subprocessors.filter((s) => s.locations.length === 0).length;

  return (
    <StepBody>
      <FormSection
        title="Pick from the vendor directory"
        description="Tick the vendors you use. We prefill their name, links and typical services; you set the processing locations yourself."
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${VENDORS.length} vendors, e.g. AWS, Stripe, Slack`}
              aria-label="Search vendors"
              className={cn(inputClasses, "h-9 pl-8")}
            />
          </div>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category" className="sm:w-56">
            <option value="all">All categories</option>
            {VENDOR_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div className="max-h-[26rem] overflow-y-auto rounded-lg border border-line bg-surface">
          {grouped.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">
              No vendors match “{query}”. You can add it as a custom subprocessor below.
            </p>
          ) : (
            grouped.map(([cat, vendors]) => (
              <div key={cat}>
                <p className="eyebrow sticky top-0 z-10 border-b border-line bg-surface-muted px-4 py-2">
                  {cat}
                </p>
                <ul className="divide-y divide-line">
                  {vendors.map((v) => {
                    const checked = optimisticSelected.has(v.slug);
                    return (
                      <li key={v.slug}>
                        <label className={cn("flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-muted", checked && "bg-accent-soft/50 hover:bg-accent-soft/70")}>
                          <Checkbox className="mt-0.5" checked={checked} onChange={(e) => toggleVendor(v, e.target.checked)} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-ink">{v.name}</span>
                            <span className="block text-[13px] text-ink-muted">{v.defaultServices}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </FormSection>

      <FormSection
        title="Your subprocessors"
        description={
          subprocessors.length
            ? `${subprocessors.length} listed${missingLocations ? ` · ${missingLocations} without processing locations` : ""}.`
            : "Nothing listed yet."
        }
      >
        {subprocessors.length === 0 ? (
          <EmptyState
            title="No subprocessors yet"
            description="Tick vendors in the directory above, or add one that is not listed."
            action={
              <Button variant="secondary" onClick={() => setDialog({ open: true, row: null })}>
                <Plus className="size-4" aria-hidden="true" /> Add custom subprocessor
              </Button>
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {subprocessors.map((s) => {
                const site = safeHttpUrl(s.websiteUrl);
                return (
                  <li key={s.id} className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">{s.name}</span>
                        {site ? (
                          <a href={site} target="_blank" rel="noreferrer" className="text-ink-faint hover:text-ink" aria-label={`${s.name} website`}>
                            <ExternalLink className="size-3.5" />
                          </a>
                        ) : null}
                        {s.locations.length === 0 ? (
                          <Badge tone="warning">
                            <AlertTriangle className="size-3" aria-hidden="true" /> No locations set
                          </Badge>
                        ) : null}
                      </div>
                      {s.services ? <p className="mt-0.5 text-[13px] text-ink-muted">{s.services}</p> : null}
                      <dl className="mt-1.5 space-y-0.5 text-[13px]">
                        <div className="flex gap-2">
                          <dt className="w-24 shrink-0 text-ink-faint">Locations</dt>
                          <dd className="text-ink-muted">{s.locations.length ? s.locations.map(locationName).join(", ") : "—"}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="w-24 shrink-0 text-ink-faint">Data</dt>
                          <dd className="text-ink-muted">{s.dataCategories.length ? s.dataCategories.map(dataCategoryLabel).join(", ") : "—"}</dd>
                        </div>
                      </dl>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="secondary" size="sm" onClick={() => setDialog({ open: true, row: s })}>
                        <Pencil className="size-3.5" aria-hidden="true" /> Edit
                      </Button>
                      <ConfirmButton onConfirm={() => remove(s)} busy={busyId === s.id}>
                        <Trash2 className="size-3.5" aria-hidden="true" /> Remove
                      </ConfirmButton>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Button variant="secondary" onClick={() => setDialog({ open: true, row: null })}>
              <Plus className="size-4" aria-hidden="true" /> Add custom subprocessor
            </Button>
          </>
        )}
      </FormSection>

      {subprocessors.length ? (
        <FormSection title="Processing locations" description="This is how the map will look on your public page.">
          <div className="rounded-lg border border-line bg-surface p-4">
            <SubprocessorMap subprocessors={mapRows} brandColor={primaryColor} />
          </div>
        </FormSection>
      ) : null}

      <SubprocessorDialog
        open={dialog.open}
        row={dialog.row}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onSaved={() => router.refresh()}
        track={track}
      />

      <StepFooter />
    </StepBody>
  );
}
