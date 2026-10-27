"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { ALL_LOCATION_OPTIONS, locationName } from "@/data/locations";
import { inputClasses } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MAX_RESULTS = 12;

/** Searchable multi-select over regions and countries, with removable chips. */
export function LocationPicker({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value: string[];
  onChange: (codes: string[]) => void;
  invalid?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const listId = `${id}-listbox`;

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const selected = new Set(value);
    const pool = ALL_LOCATION_OPTIONS.filter((o) => !selected.has(o.code));
    if (!q) return pool.slice(0, MAX_RESULTS);
    const starts = pool.filter((o) => o.name.toLowerCase().startsWith(q) || o.code.toLowerCase() === q);
    const contains = pool.filter((o) => !starts.includes(o) && o.name.toLowerCase().includes(q));
    return [...starts, ...contains].slice(0, MAX_RESULTS);
  }, [query, value]);

  const activeIndex = Math.min(active, Math.max(0, results.length - 1));

  const add = (code: string) => {
    if (!value.includes(code)) onChange([...value, code]);
    setQuery("");
    setOpen(false);
  };
  const remove = (code: string) => onChange(value.filter((c) => c !== code));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive(Math.min(results.length - 1, activeIndex + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(0, activeIndex - 1));
    } else if (e.key === "Enter") {
      // Never let Enter submit the surrounding form from this field.
      e.preventDefault();
      if (open && results[activeIndex]) add(results[activeIndex].code);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && query === "" && value.length) {
      remove(value[value.length - 1]);
    }
  };

  return (
    <div className="space-y-2">
      {value.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected locations">
          {value.map((code) => (
            <li key={code} className="inline-flex items-center gap-1 rounded-full bg-neutral-soft py-0.5 pl-2.5 pr-1 text-xs font-medium text-ink">
              {locationName(code)}
              <button
                type="button"
                onClick={() => remove(code)}
                aria-label={`Remove ${locationName(code)}`}
                className="rounded-full p-0.5 text-ink-faint hover:bg-line hover:text-ink"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="relative" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOpen(false)}>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[activeIndex] ? `${listId}-${results[activeIndex].code}` : undefined}
          aria-invalid={invalid || undefined}
          placeholder={value.length ? "Add another country or region" : "Search countries and regions, e.g. Germany, EU"}
          className={cn(inputClasses, "h-9 pl-8")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          autoComplete="off"
        />
        {open ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-line bg-surface p-1 shadow-md"
          >
            {results.length === 0 ? (
              <li className="px-2.5 py-2 text-sm text-ink-muted">No matches.</li>
            ) : (
              results.map((o, i) => (
                <li
                  key={o.code}
                  id={`${listId}-${o.code}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => add(o.code)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-[5px] px-2.5 py-1.5 text-sm",
                    i === activeIndex ? "bg-neutral-soft text-ink" : "text-ink",
                  )}
                >
                  <span>{o.name}</span>
                  <span className="text-xs text-ink-faint">{o.group === "Regions" ? "Region" : o.code}</span>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
