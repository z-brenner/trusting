"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Award, EyeOff, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import type { Certification, Contact } from "@/generated/prisma/client";
import { Badge, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/ui/field";
import { deleteCertificationAction, deleteContactAction } from "@/lib/actions/editor";
import { formatDate } from "@/lib/utils";
import { ConfirmButton } from "../confirm-button";
import { StepFooter } from "../step-footer";
import { useTrackedAction } from "../wizard-context";
import { CertificationDialog } from "./certification-dialog";
import { ContactDialog } from "./contact-dialog";

const SOON_DAYS = 90;

export function expiryState(expiresAt: Date | string | null | undefined): "expired" | "soon" | null {
  if (!expiresAt) return null;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return null;
  const diff = t - Date.now();
  if (diff < 0) return "expired";
  if (diff < SOON_DAYS * 24 * 60 * 60 * 1000) return "soon";
  return null;
}

type CertificationWithHolder = Certification & { holder: Contact | null };

export function PeopleStep({ contacts, certifications }: { contacts: Contact[]; certifications: CertificationWithHolder[] }) {
  const router = useRouter();
  const track = useTrackedAction();
  const [contactDialog, setContactDialog] = React.useState<{ open: boolean; row: Contact | null }>({ open: false, row: null });
  const [certDialog, setCertDialog] = React.useState<{ open: boolean; row: Certification | null }>({ open: false, row: null });
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const run = async (id: string, action: () => Promise<{ ok: boolean }>) => {
    setBusyId(id);
    try {
      const result = await track(action);
      if (result.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const publishedContacts = contacts.filter((c) => c.isPublished).length;

  return (
    <div className="space-y-10">
      <FormSection
        title="Contacts"
        description="People visitors can turn to for security or privacy questions. Details you do not publish stay visible to administrators only."
      >
        {contacts.length === 0 ? (
          <EmptyState
            icon={<UserRound className="size-6" />}
            title="No contacts yet"
            description="Add your security lead, data protection officer or a shared mailbox owner."
            action={
              <Button variant="secondary" onClick={() => setContactDialog({ open: true, row: null })}>
                <Plus className="size-4" aria-hidden="true" /> Add contact
              </Button>
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface shadow-xs">
              {contacts.map((c) => (
                <li key={c.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink">{c.name}</span>
                      {!c.isPublished ? (
                        <Badge>
                          <EyeOff className="size-3" aria-hidden="true" /> Hidden
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-[13px] text-ink-muted">{[c.jobTitle, c.department].filter(Boolean).join(" · ") || "No title"}</p>
                    <p className="mt-1 text-[13px] text-ink-muted">
                      {c.email ? (
                        <span>
                          {c.email} <span className="text-ink-faint">({c.publishEmail ? "published" : "admin-only"})</span>
                        </span>
                      ) : null}
                      {c.email && c.phone ? " · " : null}
                      {c.phone ? (
                        <span>
                          {c.phone} <span className="text-ink-faint">({c.publishPhone ? "published" : "admin-only"})</span>
                        </span>
                      ) : null}
                    </p>
                    {c.responsibilities ? <p className="mt-1 text-[13px] text-ink-muted">{c.responsibilities}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="secondary" size="sm" onClick={() => setContactDialog({ open: true, row: c })}>
                      <Pencil className="size-3.5" aria-hidden="true" /> Edit
                    </Button>
                    <ConfirmButton onConfirm={() => run(c.id, () => deleteContactAction(c.id))} busy={busyId === c.id}>
                      <Trash2 className="size-3.5" aria-hidden="true" /> Remove
                    </ConfirmButton>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="secondary" onClick={() => setContactDialog({ open: true, row: null })}>
                <Plus className="size-4" aria-hidden="true" /> Add contact
              </Button>
              <p className="text-[13px] text-ink-muted">
                {publishedContacts} of {contacts.length} shown publicly
              </p>
            </div>
          </>
        )}
      </FormSection>

      <FormSection title="Personnel credentials" description="Professional certifications your team holds, such as CISSP or CIPP/E.">
        {certifications.length === 0 ? (
          <EmptyState
            icon={<Award className="size-6" />}
            title="No credentials yet"
            description="Optional, but a good signal for visitors reviewing your security programme."
            action={
              <Button variant="secondary" onClick={() => setCertDialog({ open: true, row: null })}>
                <Plus className="size-4" aria-hidden="true" /> Add credential
              </Button>
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface shadow-xs">
              {certifications.map((c) => {
                const state = expiryState(c.expiresAt);
                const holder = c.holder?.name || c.holderName;
                return (
                  <li key={c.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">{c.name}</span>
                        {state === "expired" ? <Badge tone="danger">Expired</Badge> : state === "soon" ? <Badge tone="warning">Expires soon</Badge> : null}
                        {!c.isPublished ? (
                          <Badge>
                            <EyeOff className="size-3" aria-hidden="true" /> Hidden
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-[13px] text-ink-muted">
                        {[c.issuer, holder ? `held by ${holder}` : null].filter(Boolean).join(" · ") || "No issuer"}
                      </p>
                      <p className="mt-1 text-[13px] text-ink-faint">
                        {c.issuedAt ? `Issued ${formatDate(c.issuedAt)}` : null}
                        {c.issuedAt && c.expiresAt ? " · " : null}
                        {c.expiresAt ? `Expires ${formatDate(c.expiresAt)}` : null}
                        {!c.issuedAt && !c.expiresAt ? "No dates" : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="secondary" size="sm" onClick={() => setCertDialog({ open: true, row: c })}>
                        <Pencil className="size-3.5" aria-hidden="true" /> Edit
                      </Button>
                      <ConfirmButton onConfirm={() => run(c.id, () => deleteCertificationAction(c.id))} busy={busyId === c.id}>
                        <Trash2 className="size-3.5" aria-hidden="true" /> Remove
                      </ConfirmButton>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Button variant="secondary" onClick={() => setCertDialog({ open: true, row: null })}>
              <Plus className="size-4" aria-hidden="true" /> Add credential
            </Button>
          </>
        )}
      </FormSection>

      <ContactDialog
        open={contactDialog.open}
        row={contactDialog.row}
        onClose={() => setContactDialog((d) => ({ ...d, open: false }))}
        onSaved={() => router.refresh()}
        track={track}
      />
      <CertificationDialog
        open={certDialog.open}
        row={certDialog.row}
        contacts={contacts}
        onClose={() => setCertDialog((d) => ({ ...d, open: false }))}
        onSaved={() => router.refresh()}
        track={track}
      />

      <StepFooter />
    </div>
  );
}
