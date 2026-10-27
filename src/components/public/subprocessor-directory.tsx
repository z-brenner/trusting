"use client";

import * as React from "react";
import { ExternalLink, Search } from "lucide-react";
import type { SnapshotSubprocessor } from "@/lib/snapshot";
import { locationName } from "@/data/locations";
import { dataCategoryLabel } from "@/data/data-categories";
import { safeHttpUrl } from "@/lib/utils";
import { inputClasses } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Searchable subprocessor directory: a table on wide screens, stacked cards on small ones. */
export function SubprocessorDirectory({ subprocessors }: { subprocessors: SnapshotSubprocessor[] }) {
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? subprocessors.filter((s) => s.name.toLowerCase().includes(q) || s.services.toLowerCase().includes(q))
    : subprocessors;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-xs">
          <span className="sr-only">Search subprocessors by name</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or service"
            className={cn(inputClasses, "h-10 rounded-full pl-9 focus:border-[var(--brand)] focus:ring-[color-mix(in_srgb,var(--brand)_35%,white)]")}
          />
        </label>
        <p className="eyebrow" aria-live="polite">
          {filtered.length === subprocessors.length
            ? `${subprocessors.length} ${subprocessors.length === 1 ? "subprocessor" : "subprocessors"}`
            : `${filtered.length} of ${subprocessors.length} shown`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong px-5 py-8 text-center text-sm text-ink-muted">
          No subprocessors match “{query.trim()}”.
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <thead>
                <tr className="eyebrow border-b border-line bg-surface-muted">
                  <th scope="col" className="w-[32%] px-4 py-2.5">
                    Vendor
                  </th>
                  <th scope="col" className="w-[22%] px-4 py-2.5">
                    Processing locations
                  </th>
                  <th scope="col" className="w-[30%] px-4 py-2.5">
                    Data categories
                  </th>
                  <th scope="col" className="w-[16%] px-4 py-2.5">
                    Privacy
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((s) => (
                  <tr key={s.id} className="align-top transition-colors duration-150 hover:bg-surface-muted">
                    <td className="px-4 py-3">
                      <VendorName s={s} />
                      {s.services ? <p className="mt-0.5 text-[13px] text-ink-muted">{s.services}</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      <LocationChips locations={s.locations} />
                    </td>
                    <td className="px-4 py-3 text-[13px] text-ink-muted">
                      {s.dataCategories.length ? s.dataCategories.map(dataCategoryLabel).join(", ") : <span className="text-ink-muted">Not specified</span>}
                    </td>
                    <td className="px-4 py-3">
                      <PrivacyLink url={s.privacyPolicyUrl} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {filtered.map((s) => (
              <li key={s.id} className="rounded-xl border border-line bg-surface px-4 py-4">
                <VendorName s={s} />
                {s.services ? <p className="mt-0.5 text-[13px] text-ink-muted">{s.services}</p> : null}
                <dl className="mt-3 space-y-2 text-[13px]">
                  <div>
                    <dt className="eyebrow">Processing locations</dt>
                    <dd className="mt-1">
                      <LocationChips locations={s.locations} />
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Data categories</dt>
                    <dd className="mt-1 text-ink-muted">
                      {s.dataCategories.length ? s.dataCategories.map(dataCategoryLabel).join(", ") : "Not specified"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3">
                  <PrivacyLink url={s.privacyPolicyUrl} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function VendorName({ s }: { s: SnapshotSubprocessor }) {
  const url = safeHttpUrl(s.websiteUrl);
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-ink underline-offset-2 hover:text-[var(--brand-text)] hover:underline"
    >
      {s.name}
      <ExternalLink className="ml-1 inline-block size-3 align-[-1px] text-ink-faint" aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  ) : (
    <span className="font-medium text-ink">{s.name}</span>
  );
}

function LocationChips({ locations }: { locations: string[] }) {
  if (locations.length === 0) return <span className="text-[13px] text-ink-muted">Not specified</span>;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Processing locations">
      {locations.map((code) => (
        <li key={code} className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs font-medium text-ink">
          {locationName(code)}
        </li>
      ))}
    </ul>
  );
}

function PrivacyLink({ url }: { url: string }) {
  const safe = safeHttpUrl(url);
  if (!safe) return <span className="text-[13px] text-ink-muted">—</span>;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[13px] font-medium whitespace-nowrap text-[var(--brand-text)] underline-offset-2 hover:underline"
    >
      Privacy policy
      <ExternalLink className="ml-1 inline-block size-3 align-[-1px]" aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
