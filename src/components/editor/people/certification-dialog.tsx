"use client";

import * as React from "react";
import type { Certification, Contact } from "@/generated/prisma/client";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select, Switch } from "@/components/ui/input";
import { CERTIFICATION_SUGGESTIONS } from "@/data/certifications";
import { saveCertificationAction } from "@/lib/actions/editor";
import { toDateInputValue } from "@/lib/utils";
import { DialogFooter } from "../dialog-footer";

/** Form values use strings for dates; the schema turns them into Date objects. */
type FormValues = {
  name: string;
  issuer: string;
  holderId: string | null;
  holderName: string;
  issuedAt: string;
  expiresAt: string;
  credentialId: string;
  verificationUrl: string;
  isPublished: boolean;
};

const OTHER = "__other__";

const empty: FormValues = {
  name: "",
  issuer: "",
  holderId: null,
  holderName: "",
  issuedAt: "",
  expiresAt: "",
  credentialId: "",
  verificationUrl: "",
  isPublished: true,
};

function toValues(row: Certification | null): FormValues {
  if (!row) return empty;
  return {
    name: row.name,
    issuer: row.issuer,
    holderId: row.holderId,
    holderName: row.holderName,
    issuedAt: toDateInputValue(row.issuedAt),
    expiresAt: toDateInputValue(row.expiresAt),
    credentialId: row.credentialId,
    verificationUrl: row.verificationUrl,
    isPublished: row.isPublished,
  };
}

type TrackFn = <T extends { ok: boolean }>(run: () => Promise<T>) => Promise<T>;

export function CertificationDialog({
  open,
  row,
  contacts,
  onClose,
  onSaved,
  track,
}: {
  open: boolean;
  row: Certification | null;
  contacts: Contact[];
  onClose: () => void;
  onSaved: () => void;
  track: TrackFn;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={row ? `Edit ${row.name}` : "Add a credential"}
      description="Professional certifications held by people on your team."
    >
      {open ? <CertificationForm key={row?.id ?? "new"} row={row} contacts={contacts} onClose={onClose} onSaved={onSaved} track={track} /> : null}
    </Dialog>
  );
}

function CertificationForm({
  row,
  contacts,
  onClose,
  onSaved,
  track,
}: {
  row: Certification | null;
  contacts: Contact[];
  onClose: () => void;
  onSaved: () => void;
  track: TrackFn;
}) {
  const [values, setValues] = React.useState<FormValues>(() => toValues(row));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  const set = (patch: Partial<FormValues>) => setValues((v) => ({ ...v, ...patch }));

  const onNameChange = (name: string) => {
    const suggestion = CERTIFICATION_SUGGESTIONS.find((s) => s.name === name);
    // Auto-fill the issuer when a suggestion is picked and the issuer is empty or came from a suggestion.
    const issuerFromSuggestion = CERTIFICATION_SUGGESTIONS.some((s) => s.issuer === values.issuer);
    set({ name, ...(suggestion && (!values.issuer || issuerFromSuggestion) ? { issuer: suggestion.issuer } : {}) });
  };

  const holderMode = values.holderId ?? OTHER;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await track(() => saveCertificationAction(row?.id ?? null, values));
      if (result.ok) {
        onSaved();
        onClose();
      } else setErrors(result.errors ?? { _: result.message ?? "Could not save." });
    } finally {
      setSaving(false);
    }
  };

  return (
      <form id="certification-form" onSubmit={submit} className="space-y-4" noValidate>
        {errors._ ? (
          <p className="text-sm text-danger" role="alert">
            {errors._}
          </p>
        ) : null}
        <Field label="Certification" htmlFor="cert-name" error={errors.name} help="Start typing to pick from common credentials, or enter your own.">
          <Input id="cert-name" list="cert-suggestions" value={values.name} onChange={(e) => onNameChange(e.target.value)} autoComplete="off" aria-invalid={errors.name ? true : undefined} autoFocus />
          <datalist id="cert-suggestions">
            {CERTIFICATION_SUGGESTIONS.map((s) => (
              <option key={s.name} value={s.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Issuer" htmlFor="cert-issuer" optional error={errors.issuer}>
          <Input id="cert-issuer" value={values.issuer} onChange={(e) => set({ issuer: e.target.value })} placeholder="ISC2" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Holder" htmlFor="cert-holder" error={errors.holderId} help={contacts.length ? "Pick a contact or enter a name." : "Add contacts above to pick from them."}>
            <Select
              id="cert-holder"
              value={holderMode}
              onChange={(e) => set({ holderId: e.target.value === OTHER ? null : e.target.value })}
            >
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.jobTitle ? ` · ${c.jobTitle}` : ""}
                </option>
              ))}
              <option value={OTHER}>{contacts.length ? "Someone else (enter a name)" : "Enter a name"}</option>
            </Select>
          </Field>
          {!values.holderId ? (
            <Field label="Holder name" htmlFor="cert-holder-name" optional error={errors.holderName}>
              <Input id="cert-holder-name" value={values.holderName} onChange={(e) => set({ holderName: e.target.value })} placeholder="Jane Doe" />
            </Field>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Issued" htmlFor="cert-issued" optional error={errors.issuedAt}>
            <Input id="cert-issued" type="date" value={values.issuedAt} onChange={(e) => set({ issuedAt: e.target.value })} />
          </Field>
          <Field label="Expires" htmlFor="cert-expires" optional error={errors.expiresAt}>
            <Input id="cert-expires" type="date" value={values.expiresAt} onChange={(e) => set({ expiresAt: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Credential ID" htmlFor="cert-id" optional error={errors.credentialId}>
            <Input id="cert-id" value={values.credentialId} onChange={(e) => set({ credentialId: e.target.value })} />
          </Field>
          <Field label="Verification URL" htmlFor="cert-url" optional error={errors.verificationUrl}>
            <Input id="cert-url" type="url" inputMode="url" value={values.verificationUrl} onChange={(e) => set({ verificationUrl: e.target.value })} placeholder="https://" aria-invalid={errors.verificationUrl ? true : undefined} />
          </Field>
        </div>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-line px-4 py-2.5">
          <div>
            <label htmlFor="cert-published" className="block text-sm font-medium text-ink">
              Show on the Trust Center
            </label>
            <p className="mt-0.5 text-[13px] text-ink-muted">When off, this credential stays admin-only.</p>
          </div>
          <Switch id="cert-published" checked={values.isPublished} onChange={(v) => set({ isPublished: v })} label="Show on the Trust Center" className="mt-1" />
        </div>
        <DialogFooter saving={saving} onClose={onClose} submitLabel={row ? "Save changes" : "Add credential"} formId="certification-form" />
      </form>
  );
}
