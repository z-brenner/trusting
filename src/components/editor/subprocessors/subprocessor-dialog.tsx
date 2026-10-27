"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";
import type { Subprocessor } from "@/generated/prisma/client";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/card";
import { DATA_CATEGORIES } from "@/data/data-categories";
import { vendorBySlug } from "@/data/vendors";
import { saveSubprocessorAction } from "@/lib/actions/editor";
import type { SubprocessorInput } from "@/lib/validation";
import { LocationPicker } from "./location-picker";
import { DialogFooter } from "../dialog-footer";

type FormValues = SubprocessorInput;

const empty: FormValues = {
  vendorSlug: null,
  name: "",
  websiteUrl: "",
  privacyPolicyUrl: "",
  services: "",
  locations: [],
  dataCategories: [],
  notes: "",
};

function toValues(row: Subprocessor | null): FormValues {
  if (!row) return empty;
  return {
    vendorSlug: row.vendorSlug,
    name: row.name,
    websiteUrl: row.websiteUrl,
    privacyPolicyUrl: row.privacyPolicyUrl,
    services: row.services,
    locations: row.locations,
    dataCategories: row.dataCategories,
    notes: row.notes,
  };
}


type TrackFn = <T extends { ok: boolean }>(run: () => Promise<T>) => Promise<T>;

export function SubprocessorDialog({
  open,
  row,
  onClose,
  onSaved,
  track,
}: {
  open: boolean;
  /** Existing row to edit, or null to create a custom subprocessor. */
  row: Subprocessor | null;
  onClose: () => void;
  onSaved: () => void;
  track: TrackFn;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={row ? `Edit ${row.name}` : "Add a custom subprocessor"}
      description="Describe what this vendor does for you and where it processes personal data."
    >
      {open ? <SubprocessorForm key={row?.id ?? "new"} row={row} onClose={onClose} onSaved={onSaved} track={track} /> : null}
    </Dialog>
  );
}

/** Mounted only while the dialog is open, so every opening starts from the row's values. */
function SubprocessorForm({
  row,
  onClose,
  onSaved,
  track,
}: {
  row: Subprocessor | null;
  onClose: () => void;
  onSaved: () => void;
  track: TrackFn;
}) {
  const [values, setValues] = React.useState<FormValues>(() => toValues(row));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  const vendor = values.vendorSlug ? vendorBySlug(values.vendorSlug) : undefined;
  const set = (patch: Partial<FormValues>) => setValues((v) => ({ ...v, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await track(() => saveSubprocessorAction(row?.id ?? null, values));
      if (result.ok) {
        onSaved();
        onClose();
      } else {
        setErrors(result.errors ?? { _: result.message ?? "Could not save." });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
      <form id="subprocessor-form" onSubmit={submit} className="space-y-5" noValidate>
        {errors._ ? (
          <p className="text-sm text-danger" role="alert">
            {errors._}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vendor name" htmlFor="sp-name" error={errors.name} className="sm:col-span-2">
            <Input id="sp-name" value={values.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={errors.name ? true : undefined} autoFocus />
          </Field>
          <Field label="Website" htmlFor="sp-website" optional error={errors.websiteUrl}>
            <Input id="sp-website" type="url" inputMode="url" value={values.websiteUrl} onChange={(e) => set({ websiteUrl: e.target.value })} placeholder="https://" aria-invalid={errors.websiteUrl ? true : undefined} />
          </Field>
          <Field label="Privacy policy URL" htmlFor="sp-privacy" optional error={errors.privacyPolicyUrl}>
            <Input id="sp-privacy" type="url" inputMode="url" value={values.privacyPolicyUrl} onChange={(e) => set({ privacyPolicyUrl: e.target.value })} placeholder="https://" aria-invalid={errors.privacyPolicyUrl ? true : undefined} />
          </Field>
        </div>
        <Field label="Services provided" htmlFor="sp-services" error={errors.services} help="What the vendor does for you, in a few words.">
          <Input id="sp-services" value={values.services} onChange={(e) => set({ services: e.target.value })} placeholder="Cloud hosting and backups" />
        </Field>

        <Field label="Processing locations" htmlFor="sp-locations" error={errors.locations}>
          <div className="space-y-3">
            <Alert tone="info">
              Select where this vendor processes your data (per your contract/DPA). A vendor&apos;s headquarters is not
              necessarily a processing location.
              {vendor?.dataLocationsUrl ? (
                <>
                  {" "}
                  <a href={vendor.dataLocationsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                    Check the vendor&apos;s regions page <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                </>
              ) : null}
            </Alert>
            <LocationPicker id="sp-locations" value={values.locations} onChange={(locations) => set({ locations })} invalid={Boolean(errors.locations)} />
          </div>
        </Field>

        <fieldset className="min-w-0">
          <legend className="text-sm font-medium text-ink">Categories of personal data</legend>
          <p className="mt-0.5 text-[13px] text-ink-muted">Tick everything this vendor may receive.</p>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {DATA_CATEGORIES.map((c) => {
              const checked = values.dataCategories.includes(c.code);
              return (
                <label key={c.code} className="flex cursor-pointer items-start gap-2.5 rounded-md border border-line px-3 py-2 text-sm hover:bg-surface-muted">
                  <Checkbox
                    className="mt-0.5"
                    checked={checked}
                    onChange={(e) =>
                      set({
                        dataCategories: e.target.checked
                          ? [...values.dataCategories, c.code]
                          : values.dataCategories.filter((x) => x !== c.code),
                      })
                    }
                  />
                  <span>
                    <span className="block font-medium text-ink">{c.label}</span>
                    <span className="block text-[13px] text-ink-muted">{c.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {errors.dataCategories ? (
            <p className="mt-1.5 text-[13px] text-danger" role="alert">
              {errors.dataCategories}
            </p>
          ) : null}
        </fieldset>

        <Field label="Notes" htmlFor="sp-notes" optional error={errors.notes} help="Shown publicly, e.g. the safeguards used for transfers.">
          <Textarea id="sp-notes" rows={3} className="min-h-0" value={values.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        <DialogFooter saving={saving} onClose={onClose} submitLabel={row ? "Save changes" : "Add subprocessor"} formId="subprocessor-form" />
      </form>
  );
}
