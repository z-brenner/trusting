"use client";

import * as React from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import { X } from "lucide-react";
import type { SnapshotSubprocessor } from "@/lib/snapshot";
import { countryByNumeric, expandLocationToCountries, locationName } from "@/data/locations";
import { cn } from "@/lib/utils";

/**
 * Interactive world map of disclosed processing locations.
 *
 * Self-contained: depends only on its props so it can be reused inside the
 * editor's live preview. Countries come from world-atlas (ISO numeric ids),
 * mapped to ISO alpha-2 codes through the shared country directory.
 */
export type SubprocessorMapProps = {
  subprocessors: SnapshotSubprocessor[];
  brandColor?: string;
  className?: string;
};

type CountryFeature = { type: "Feature"; id?: string | number; properties?: { name?: string } | null; geometry: unknown };
type CountriesTopology = Parameters<typeof feature>[0] & { objects: { countries: Parameters<typeof feature>[1] } };

const WIDTH = 960;
const HEIGHT = 470;
const ANTARCTICA = "010";

const topology = world as unknown as CountriesTopology;
const countryFeatures = (feature(topology, topology.objects.countries) as unknown as { features: CountryFeature[] }).features.filter(
  (f) => String(f.id) !== ANTARCTICA,
);

const projection = geoNaturalEarth1().fitExtent(
  [
    [8, 8],
    [WIDTH - 8, HEIGHT - 8],
  ],
  { type: "FeatureCollection", features: countryFeatures } as never,
);
const pathGenerator = geoPath(projection);
const PATHS = countryFeatures.map((f) => ({ id: String(f.id ?? ""), d: pathGenerator(f as never) ?? "", fallbackName: f.properties?.name ?? "" }));

type Tooltip = { x: number; y: number; name: string; count: number };

export function SubprocessorMap({ subprocessors, brandColor = "#1f3a5f", className }: SubprocessorMapProps) {
  // alpha-2 code -> subprocessors that disclose processing there
  const byCountry = React.useMemo(() => {
    const m = new Map<string, SnapshotSubprocessor[]>();
    for (const s of subprocessors) {
      const codes = new Set(s.locations.flatMap(expandLocationToCountries));
      for (const code of codes) {
        const list = m.get(code) ?? [];
        list.push(s);
        m.set(code, list);
      }
    }
    return m;
  }, [subprocessors]);

  const globalVendors = subprocessors.filter((s) => s.locations.includes("GLOBAL"));
  const unspecifiedVendors = subprocessors.filter((s) => s.locations.length === 0);
  const maxCount = Math.max(1, ...Array.from(byCountry.values(), (v) => v.length));

  const [selected, setSelected] = React.useState<string | null>(null);
  const [tooltip, setTooltip] = React.useState<Tooltip | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedVendors = selected ? byCountry.get(selected) ?? [] : [];

  if (byCountry.size === 0) {
    return (
      <div className={cn("rounded-lg border border-dashed border-line-strong bg-surface px-5 py-6 text-sm text-ink-muted", className)}>
        <p>No country-level processing locations have been disclosed, so there is nothing to show on a map.</p>
        <LocationNotes globalVendors={globalVendors} unspecifiedVendors={unspecifiedVendors} />
      </div>
    );
  }

  const showTooltipAt = (clientX: number, clientY: number, code: string) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    setTooltip({ x: clientX - box.left, y: clientY - box.top, name: locationName(code), count: byCountry.get(code)?.length ?? 0 });
  };

  const onFocusPath = (e: React.FocusEvent<SVGPathElement>, code: string) => {
    const r = e.currentTarget.getBoundingClientRect();
    showTooltipAt(r.left + r.width / 2, r.top + r.height / 2, code);
  };

  const toggle = (code: string) => setSelected((cur) => (cur === code ? null : code));

  return (
    <div className={cn("space-y-4", className)}>
      <div ref={containerRef} className="relative overflow-hidden rounded-xl border border-line bg-surface">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block h-auto w-full"
          role="group"
          aria-label="World map of disclosed subprocessor processing locations"
          onMouseLeave={() => setTooltip(null)}
        >
          {PATHS.map((p) => {
            const country = countryByNumeric(p.id);
            const code = country?.code;
            const vendors = code ? byCountry.get(code) : undefined;
            if (!vendors || !code) {
              return <path key={p.id || p.fallbackName} d={p.d} fill="#ebebe7" stroke="#ffffff" strokeWidth={0.6} aria-hidden="true" />;
            }
            const count = vendors.length;
            const isSelected = selected === code;
            const opacity = 0.3 + 0.5 * (count / maxCount);
            return (
              <path
                key={p.id}
                d={p.d}
                fill={brandColor}
                fillOpacity={isSelected ? 1 : opacity}
                stroke="#ffffff"
                strokeWidth={isSelected ? 1.4 : 0.6}
                className="cursor-pointer outline-none transition-[fill-opacity] duration-150 hover:[fill-opacity:0.95] focus-visible:[fill-opacity:0.95]"
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={`${country.name}: ${count} ${count === 1 ? "subprocessor" : "subprocessors"}`}
                onMouseMove={(e) => showTooltipAt(e.clientX, e.clientY, code)}
                onMouseEnter={(e) => showTooltipAt(e.clientX, e.clientY, code)}
                onFocus={(e) => onFocusPath(e, code)}
                onBlur={() => setTooltip(null)}
                onClick={() => toggle(code)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle(code);
                  }
                }}
              />
            );
          })}
        </svg>

        {tooltip ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink shadow-md"
            style={{ left: tooltip.x, top: tooltip.y - 10 }}
          >
            <span className="font-medium">{tooltip.name}</span>
            <span className="text-ink-muted">
              {" "}
              · {tooltip.count} {tooltip.count === 1 ? "subprocessor" : "subprocessors"}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-muted" aria-label="Legend">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block size-3 rounded-sm" style={{ backgroundColor: brandColor, opacity: 0.75 }} aria-hidden="true" />
          Disclosed processing location
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block size-3 rounded-sm bg-[#ebebe7]" aria-hidden="true" />
          No disclosed processing
        </span>
        <span className="basis-full text-ink-muted sm:basis-auto">
          Highlights show where subprocessors process data, not where they are headquartered. Darker shading means more subprocessors.
        </span>
      </div>

      <div aria-live="polite">
        {selected ? (
          <div className="rounded-xl border border-line bg-surface px-5 py-4 animate-fade-in">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-[15px] font-semibold text-ink">
                {selectedVendors.length} {selectedVendors.length === 1 ? "subprocessor processes" : "subprocessors process"} data in{" "}
                {locationName(selected)}
              </h3>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[13px] text-ink-muted transition-colors duration-150 hover:bg-neutral-soft hover:text-ink"
              >
                <X className="size-3.5" aria-hidden="true" />
                Clear selection
              </button>
            </div>
            <ul className="mt-3 divide-y divide-line">
              {selectedVendors.map((v) => (
                <li key={v.id} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <span className="text-sm font-medium text-ink">{v.name}</span>
                  {v.services ? <span className="text-[13px] text-ink-muted sm:text-right">{v.services}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-[13px] text-ink-muted">Select a highlighted country to see which subprocessors process data there.</p>
        )}
      </div>

      <LocationNotes globalVendors={globalVendors} unspecifiedVendors={unspecifiedVendors} />
    </div>
  );
}

function LocationNotes({ globalVendors, unspecifiedVendors }: { globalVendors: SnapshotSubprocessor[]; unspecifiedVendors: SnapshotSubprocessor[] }) {
  if (globalVendors.length === 0 && unspecifiedVendors.length === 0) return null;
  return (
    <dl className="space-y-1.5 text-[13px] text-ink-muted">
      {globalVendors.length > 0 ? (
        <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
          <dt className="shrink-0 font-medium text-ink">Multiple regions worldwide:</dt>
          <dd>{globalVendors.map((v) => v.name).join(", ")}</dd>
        </div>
      ) : null}
      {unspecifiedVendors.length > 0 ? (
        <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
          <dt className="shrink-0 font-medium text-ink">Location not specified:</dt>
          <dd>{unspecifiedVendors.map((v) => v.name).join(", ")}</dd>
        </div>
      ) : null}
    </dl>
  );
}
