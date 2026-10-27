"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type RequestableDocument = {
  id: string;
  title: string;
  categoryLabel: string;
};

type ApiResponse =
  | { ok: true }
  | { ok: false; errors?: Record<string, string>; error?: string };

/**
 * Visitor-facing access request form. Posts JSON to /api/access-requests.
 * Includes a honeypot field ("website") that must stay empty.
 */
export function RequestAccessDialog({
  open,
  onClose,
  documents,
  initialSelection,
}: {
  open: boolean;
  onClose: () => void;
  documents: RequestableDocument[];
  initialSelection: string[];
}) {
  const [done, setDone] = React.useState(false);
  const handleClose = () => {
    setDone(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={done ? "Request received" : "Request access to documents"}
      description={
        done
          ? undefined
          : "Tell us who you are and which documents you need. Requests are reviewed by the organisation."
      }
      size="md"
    >
      {done ? (
        <div className="flex flex-col items-center py-4 text-center">
          <CheckCircle2
            className="mb-3 size-8 text-success"
            aria-hidden="true"
          />
          <p className="text-[15px] font-medium text-ink">
            We’ve received your request.
          </p>
          <p className="mt-1 max-w-sm text-sm text-ink-muted">
            You’ll get an email when it’s reviewed.
          </p>
          <Button variant="secondary" className="mt-6" onClick={handleClose}>
            Close
          </Button>
        </div>
      ) : (
        // The Dialog only mounts children while open, so the form state resets on every open.
        <RequestForm
          documents={documents}
          initialSelection={initialSelection}
          onCancel={handleClose}
          onDone={() => setDone(true)}
        />
      )}
    </Dialog>
  );
}

function RequestForm({
  documents,
  initialSelection,
  onCancel,
  onDone,
}: {
  documents: RequestableDocument[];
  initialSelection: string[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(initialSelection),
  );
  const [values, setValues] = React.useState({
    requesterName: "",
    requesterEmail: "",
    company: "",
    message: "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const honeypotRef = React.useRef<HTMLInputElement>(null);

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const set =
    (key: keyof typeof values) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          documentIds: Array.from(selected),
          website: honeypotRef.current?.value ?? "",
        }),
      });
      const data = (await res.json().catch(() => null)) as ApiResponse | null;
      if (res.ok && data?.ok) {
        onDone();
        return;
      }
      if (res.status === 429) {
        setFormError(
          "You have sent several requests recently. Please try again later.",
        );
      } else if (data && !data.ok && data.errors) {
        setErrors(data.errors);
      } else {
        setFormError(
          (data && !data.ok && data.error) ||
            "Something went wrong. Please try again.",
        );
      }
      setSubmitting(false);
    } catch {
      setFormError(
        "We could not reach the server. Check your connection and try again.",
      );
      setSubmitting(false);
    }
  }

  const describedBy = (field: string) =>
    errors[field] ? `${field}-error` : undefined;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <fieldset>
        <legend className="text-sm font-medium text-ink">Documents</legend>
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md border border-line p-1.5">
          {documents.map((d) => {
            const id = `req-doc-${d.id}`;
            return (
              <li key={d.id}>
                <label
                  htmlFor={id}
                  className="flex cursor-pointer items-start gap-3 rounded-sm px-2 py-1.5 hover:bg-surface-muted"
                >
                  <Checkbox
                    id={id}
                    checked={selected.has(d.id)}
                    onChange={() => toggle(d.id)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">{d.title}</span>
                    <span className="block text-xs text-ink-muted">
                      {d.categoryLabel}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {errors.documentIds ? (
          <p
            id="documentIds-error"
            className="mt-1.5 text-[13px] text-danger"
            role="alert"
          >
            {errors.documentIds}
          </p>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Your name"
          htmlFor="requesterName"
          error={errors.requesterName}
        >
          <Input
            id="requesterName"
            name="requesterName"
            autoComplete="name"
            required
            value={values.requesterName}
            onChange={set("requesterName")}
            aria-invalid={Boolean(errors.requesterName)}
            aria-describedby={describedBy("requesterName")}
          />
        </Field>
        <Field
          label="Work email"
          htmlFor="requesterEmail"
          error={errors.requesterEmail}
        >
          <Input
            id="requesterEmail"
            name="requesterEmail"
            type="email"
            autoComplete="email"
            required
            value={values.requesterEmail}
            onChange={set("requesterEmail")}
            aria-invalid={Boolean(errors.requesterEmail)}
            aria-describedby={describedBy("requesterEmail")}
          />
        </Field>
      </div>
      <Field label="Company" htmlFor="company" optional error={errors.company}>
        <Input
          id="company"
          name="company"
          autoComplete="organization"
          value={values.company}
          onChange={set("company")}
        />
      </Field>
      <Field
        label="Message"
        htmlFor="message"
        optional
        help="Why you need these documents, e.g. a vendor assessment."
        error={errors.message}
      >
        <Textarea
          id="message"
          name="message"
          rows={3}
          value={values.message}
          onChange={set("message")}
        />
      </Field>

      {/* Honeypot: hidden from people, tempting for bots. */}
      <div
        className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden"
        aria-hidden="true"
      >
        <label htmlFor="website">Website</label>
        <input
          ref={honeypotRef}
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      {formError ? (
        <p
          className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-ink"
          role="alert"
        >
          {formError}
        </p>
      ) : null}

      <p className="text-xs text-ink-muted">
        We use these details only to review your request.
      </p>

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          loading={submitting}
          className="bg-[var(--brand)] text-[var(--brand-fg)] hover:bg-[var(--brand)] hover:brightness-95 disabled:bg-[var(--brand)]"
        >
          Send request
        </Button>
      </div>
    </form>
  );
}
