"use client";

import * as React from "react";
import type { Contact } from "@/generated/prisma/client";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Switch, Textarea } from "@/components/ui/input";
import { saveContactAction } from "@/lib/actions/editor";
import type { ContactInput } from "@/lib/validation";
import { DialogFooter } from "../dialog-footer";

const empty: ContactInput = {
  name: "",
  jobTitle: "",
  department: "",
  email: "",
  phone: "",
  responsibilities: "",
  publishEmail: false,
  publishPhone: false,
  isPublished: true,
};

function toValues(row: Contact | null): ContactInput {
  if (!row) return empty;
  return {
    name: row.name,
    jobTitle: row.jobTitle,
    department: row.department,
    email: row.email,
    phone: row.phone,
    responsibilities: row.responsibilities,
    publishEmail: row.publishEmail,
    publishPhone: row.publishPhone,
    isPublished: row.isPublished,
  };
}

function ToggleRow({ id, label, help, checked, onChange }: { id: string; label: string; help: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
        </label>
        <p className="mt-0.5 text-[13px] text-ink-muted">{help}</p>
      </div>
      <Switch id={id} checked={checked} onChange={onChange} label={label} className="mt-1" />
    </div>
  );
}

type TrackFn = <T extends { ok: boolean }>(run: () => Promise<T>) => Promise<T>;

export function ContactDialog({
  open,
  row,
  onClose,
  onSaved,
  track,
}: {
  open: boolean;
  row: Contact | null;
  onClose: () => void;
  onSaved: () => void;
  track: TrackFn;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={row ? `Edit ${row.name}` : "Add a contact"}
      description="Unpublished details stay visible to administrators only."
    >
      {open ? <ContactForm key={row?.id ?? "new"} row={row} onClose={onClose} onSaved={onSaved} track={track} /> : null}
    </Dialog>
  );
}

function ContactForm({ row, onClose, onSaved, track }: { row: Contact | null; onClose: () => void; onSaved: () => void; track: TrackFn }) {
  const [values, setValues] = React.useState<ContactInput>(() => toValues(row));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  const set = (patch: Partial<ContactInput>) => setValues((v) => ({ ...v, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await track(() => saveContactAction(row?.id ?? null, values));
      if (result.ok) {
        onSaved();
        onClose();
      } else setErrors(result.errors ?? { _: result.message ?? "Could not save." });
    } finally {
      setSaving(false);
    }
  };

  return (
      <form id="contact-form" onSubmit={submit} className="space-y-4" noValidate>
        {errors._ ? (
          <p className="text-sm text-danger" role="alert">
            {errors._}
          </p>
        ) : null}
        <Field label="Name" htmlFor="ct-name" error={errors.name}>
          <Input id="ct-name" value={values.name} onChange={(e) => set({ name: e.target.value })} autoComplete="off" aria-invalid={errors.name ? true : undefined} autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Job title" htmlFor="ct-title" optional error={errors.jobTitle}>
            <Input id="ct-title" value={values.jobTitle} onChange={(e) => set({ jobTitle: e.target.value })} placeholder="Head of Security" />
          </Field>
          <Field label="Department" htmlFor="ct-dept" optional error={errors.department}>
            <Input id="ct-dept" value={values.department} onChange={(e) => set({ department: e.target.value })} placeholder="Engineering" />
          </Field>
        </div>
        <Field label="Responsibilities" htmlFor="ct-resp" optional error={errors.responsibilities} help="For example “Data protection officer, security incidents”.">
          <Textarea id="ct-resp" rows={2} className="min-h-0" value={values.responsibilities} onChange={(e) => set({ responsibilities: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="ct-email" optional error={errors.email}>
            <Input id="ct-email" type="email" inputMode="email" value={values.email} onChange={(e) => set({ email: e.target.value })} aria-invalid={errors.email ? true : undefined} />
          </Field>
          <Field label="Phone" htmlFor="ct-phone" optional error={errors.phone}>
            <Input id="ct-phone" type="tel" inputMode="tel" value={values.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
        </div>
        <div className="divide-y divide-line rounded-lg border border-line px-4">
          <ToggleRow id="ct-published" label="Show this person on the Trust Center" help="When off, the whole entry stays admin-only." checked={values.isPublished} onChange={(v) => set({ isPublished: v })} />
          <ToggleRow id="ct-pub-email" label="Publish email address" help="Otherwise the address is kept for your records only." checked={values.publishEmail} onChange={(v) => set({ publishEmail: v })} />
          <ToggleRow id="ct-pub-phone" label="Publish phone number" help="Otherwise the number is kept for your records only." checked={values.publishPhone} onChange={(v) => set({ publishPhone: v })} />
        </div>
        <DialogFooter saving={saving} onClose={onClose} submitLabel={row ? "Save changes" : "Add contact"} formId="contact-form" />
      </form>
  );
}
