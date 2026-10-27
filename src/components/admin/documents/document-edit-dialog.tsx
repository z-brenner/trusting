"use client";

import * as React from "react";
import { Dialog, Button, Field, Input, Textarea, Select, Checkbox, Alert } from "@/components/ui";
import { DOCUMENT_CATEGORIES, VISIBILITY_OPTIONS } from "@/data/document-categories";
import { updateDocumentAction } from "@/lib/actions/documents";
import { toDateInputValue, cn } from "@/lib/utils";
import type { DocumentListItem } from "./document-manager";

export function DocumentEditDialog({
  document,
  onClose,
  onSaved,
}: {
  document: DocumentListItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [message, setMessage] = React.useState<string | null>(null);
  const [visibility, setVisibility] = React.useState(document.visibility);

  const visibilityChanged = visibility !== document.visibility;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setErrors({});
    setMessage(null);
    const result = await updateDocumentAction(document.id, {
      title: form.get("title"),
      description: form.get("description"),
      category: form.get("category"),
      visibility,
      allowDownload: form.get("allowDownload") === "on",
      versionLabel: form.get("versionLabel"),
      documentDate: form.get("documentDate"),
    });
    setPending(false);
    if (result.ok) {
      onSaved();
      onClose();
    } else {
      setErrors(result.errors ?? {});
      setMessage(result.message ?? (result.errors ? null : "Could not save the document."));
    }
  }

  return (
    <Dialog open onClose={onClose} title="Edit document" description={document.fileName} size="md">
      <form id="document-edit-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        {message ? <Alert tone="danger">{message}</Alert> : null}
        <Field label="Title" htmlFor="doc-title" error={errors.title}>
          <Input id="doc-title" name="title" defaultValue={document.title} required maxLength={200} aria-invalid={Boolean(errors.title)} />
        </Field>
        <Field label="Description" htmlFor="doc-description" optional error={errors.description}>
          <Textarea id="doc-description" name="description" defaultValue={document.description} maxLength={2000} className="min-h-20" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="doc-category" error={errors.category}>
            <Select id="doc-category" name="category" defaultValue={document.category}>
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Version" htmlFor="doc-version" optional error={errors.versionLabel}>
            <Input id="doc-version" name="versionLabel" defaultValue={document.versionLabel} placeholder="e.g. v2.1 or 2026" maxLength={100} />
          </Field>
        </div>
        <Field label="Document date" htmlFor="doc-date" optional help="When this version was issued." error={errors.documentDate}>
          <Input id="doc-date" name="documentDate" type="date" defaultValue={toDateInputValue(document.documentDate)} />
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">Visibility</legend>
          {VISIBILITY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors",
                visibility === opt.value ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-muted",
              )}
            >
              <input
                type="radio"
                name="visibility"
                value={opt.value}
                checked={visibility === opt.value}
                onChange={() => setVisibility(opt.value)}
                className="mt-1 size-4 accent-[var(--color-accent)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{opt.label}</span>
                <span className="block text-[13px] text-ink-muted">{opt.description}</span>
              </span>
            </label>
          ))}
          {visibilityChanged && visibility !== "PRIVATE" ? (
            <p className="text-[13px] text-ink-muted">
              Visitors will only see this document after you publish the Trust Center again.
            </p>
          ) : null}
          {errors.visibility ? <p className="text-[13px] text-danger">{errors.visibility}</p> : null}
        </fieldset>

        <label className="flex items-center gap-2 text-sm text-ink">
          <Checkbox name="allowDownload" defaultChecked={document.allowDownload} />
          Allow visitors to download the file (otherwise PDFs open in the browser only)
        </label>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            Save changes
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
