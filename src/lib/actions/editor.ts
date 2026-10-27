"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDraft, TRUST_CENTER_ID } from "@/lib/trust-center";
import {
  certificationSchema,
  companySchema,
  contactSchema,
  fieldErrors,
  frameworkEntrySchema,
  subprocessorSchema,
} from "@/lib/validation";
import { frameworkBySlug } from "@/data/frameworks";
import { vendorBySlug } from "@/data/vendors";
import type { FrameworkStatus } from "@/generated/prisma/enums";

/**
 * Server actions behind the guided editor. Every action re-checks the admin
 * session, validates with the shared zod schemas and returns a small,
 * serialisable result so client components can show inline errors.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; errors?: Record<string, string>; message?: string };

const WIZARD_STEP_COUNT = 6;

function revalidateEditor() {
  revalidatePath("/admin/edit", "layout");
  revalidatePath("/preview");
  revalidatePath("/admin");
}

function clampStep(step: number) {
  return Math.min(WIZARD_STEP_COUNT, Math.max(1, Math.trunc(Number(step) || 1)));
}

const unexpected = (err: unknown): ActionResult<never> => {
  console.error(err);
  return { ok: false, message: "Something went wrong while saving. Please try again." };
};

// ---------- Navigation ----------

/** Remember which step the administrator is on so /admin/edit can resume there. */
export async function setWizardStepAction(step: number): Promise<ActionResult> {
  await requireAdmin();
  try {
    await getDraft();
    await prisma.trustCenter.update({ where: { id: TRUST_CENTER_ID }, data: { wizardStep: clampStep(step) } });
    revalidatePath("/admin/edit", "layout");
    return { ok: true, data: undefined };
  } catch (err) {
    return unexpected(err);
  }
}

// ---------- Step 1: company ----------

export async function saveCompanyAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  try {
    await getDraft();
    await prisma.trustCenter.update({ where: { id: TRUST_CENTER_ID }, data: parsed.data });
    revalidateEditor();
    return { ok: true, data: undefined };
  } catch (err) {
    return unexpected(err);
  }
}

// ---------- Step 2: subprocessors ----------

async function nextSortOrder(model: "subprocessor" | "frameworkEntry" | "contact" | "certification") {
  switch (model) {
    case "subprocessor":
      return prisma.subprocessor.count({ where: { trustCenterId: TRUST_CENTER_ID } });
    case "frameworkEntry":
      return prisma.frameworkEntry.count({ where: { trustCenterId: TRUST_CENTER_ID } });
    case "contact":
      return prisma.contact.count({ where: { trustCenterId: TRUST_CENTER_ID } });
    case "certification":
      return prisma.certification.count({ where: { trustCenterId: TRUST_CENTER_ID } });
  }
}

/** Tick a vendor in the directory: creates a prefilled subprocessor (idempotent per vendor). */
export async function addVendorSubprocessorAction(slug: string): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const vendor = vendorBySlug(String(slug));
  if (!vendor) return { ok: false, message: "Unknown vendor." };
  try {
    await getDraft();
    const existing = await prisma.subprocessor.findFirst({
      where: { trustCenterId: TRUST_CENTER_ID, vendorSlug: vendor.slug },
      select: { id: true },
    });
    if (existing) return { ok: true, data: { id: existing.id } };
    const row = await prisma.subprocessor.create({
      data: {
        trustCenterId: TRUST_CENTER_ID,
        vendorSlug: vendor.slug,
        name: vendor.name,
        websiteUrl: vendor.websiteUrl,
        privacyPolicyUrl: vendor.privacyPolicyUrl,
        services: vendor.defaultServices,
        sortOrder: await nextSortOrder("subprocessor"),
      },
      select: { id: true },
    });
    revalidateEditor();
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return unexpected(err);
  }
}

/** Untick a vendor in the directory: removes every subprocessor created from it. */
export async function removeVendorSubprocessorAction(slug: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await prisma.subprocessor.deleteMany({ where: { trustCenterId: TRUST_CENTER_ID, vendorSlug: String(slug) } });
    revalidateEditor();
    return { ok: true, data: undefined };
  } catch (err) {
    return unexpected(err);
  }
}

export async function saveSubprocessorAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = subprocessorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const data = { ...parsed.data, vendorSlug: parsed.data.vendorSlug ?? null };
  try {
    await getDraft();
    let rowId: string;
    if (id) {
      const row = await prisma.subprocessor.update({
        where: { id, trustCenterId: TRUST_CENTER_ID },
        data,
        select: { id: true },
      });
      rowId = row.id;
    } else {
      const row = await prisma.subprocessor.create({
        data: { ...data, trustCenterId: TRUST_CENTER_ID, sortOrder: await nextSortOrder("subprocessor") },
        select: { id: true },
      });
      rowId = row.id;
    }
    revalidateEditor();
    return { ok: true, data: { id: rowId } };
  } catch (err) {
    return unexpected(err);
  }
}

export async function deleteSubprocessorAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await prisma.subprocessor.deleteMany({ where: { id: String(id), trustCenterId: TRUST_CENTER_ID } });
    revalidateEditor();
    return { ok: true, data: undefined };
  } catch (err) {
    return unexpected(err);
  }
}

// ---------- Step 3: frameworks ----------

/** The least ambitious status a framework allows; the administrator picks the real one. */
function defaultStatusFor(allowed: FrameworkStatus[]): FrameworkStatus {
  if (allowed.includes("IN_PROGRESS")) return "IN_PROGRESS";
  return allowed[allowed.length - 1];
}

export async function addFrameworkAction(slug: string): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const def = frameworkBySlug(String(slug));
  if (!def) return { ok: false, message: "Unknown framework." };
  try {
    await getDraft();
    const row = await prisma.frameworkEntry.upsert({
      where: { trustCenterId_frameworkSlug: { trustCenterId: TRUST_CENTER_ID, frameworkSlug: def.slug } },
      update: {},
      create: {
        trustCenterId: TRUST_CENTER_ID,
        frameworkSlug: def.slug,
        status: defaultStatusFor(def.allowedStatuses),
        details: {},
        sortOrder: await nextSortOrder("frameworkEntry"),
      },
      select: { id: true },
    });
    revalidateEditor();
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return unexpected(err);
  }
}

export async function removeFrameworkAction(slug: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await prisma.frameworkEntry.deleteMany({ where: { trustCenterId: TRUST_CENTER_ID, frameworkSlug: String(slug) } });
    revalidateEditor();
    return { ok: true, data: undefined };
  } catch (err) {
    return unexpected(err);
  }
}

/** Save one framework entry, replacing its set of supporting documents. */
export async function saveFrameworkAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = frameworkEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { frameworkSlug, documentIds, details, ...rest } = parsed.data;
  try {
    await getDraft();
    // Only link documents that belong to this installation.
    const docs = await prisma.document.findMany({
      where: { trustCenterId: TRUST_CENTER_ID, id: { in: documentIds } },
      select: { id: true },
    });
    await prisma.$transaction(async (tx) => {
      const entry = await tx.frameworkEntry.upsert({
        where: { trustCenterId_frameworkSlug: { trustCenterId: TRUST_CENTER_ID, frameworkSlug } },
        update: { ...rest, details },
        create: {
          ...rest,
          details,
          frameworkSlug,
          trustCenterId: TRUST_CENTER_ID,
          sortOrder: await tx.frameworkEntry.count({ where: { trustCenterId: TRUST_CENTER_ID } }),
        },
        select: { id: true },
      });
      await tx.frameworkDocument.deleteMany({ where: { frameworkEntryId: entry.id } });
      if (docs.length) {
        await tx.frameworkDocument.createMany({
          data: docs.map((d) => ({ frameworkEntryId: entry.id, documentId: d.id })),
        });
      }
    });
    revalidateEditor();
    return { ok: true, data: undefined };
  } catch (err) {
    return unexpected(err);
  }
}

// ---------- Step 4: contacts and certifications ----------

export async function saveContactAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  try {
    await getDraft();
    const row = id
      ? await prisma.contact.update({ where: { id, trustCenterId: TRUST_CENTER_ID }, data: parsed.data, select: { id: true } })
      : await prisma.contact.create({
          data: { ...parsed.data, trustCenterId: TRUST_CENTER_ID, sortOrder: await nextSortOrder("contact") },
          select: { id: true },
        });
    revalidateEditor();
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return unexpected(err);
  }
}

export async function deleteContactAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await prisma.contact.deleteMany({ where: { id: String(id), trustCenterId: TRUST_CENTER_ID } });
    revalidateEditor();
    return { ok: true, data: undefined };
  } catch (err) {
    return unexpected(err);
  }
}

export async function saveCertificationAction(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = certificationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { holderId, ...rest } = parsed.data;
  try {
    await getDraft();
    // A holder must be one of our contacts; otherwise fall back to the free-text name.
    let holder: string | null = null;
    if (holderId) {
      const c = await prisma.contact.findFirst({ where: { id: holderId, trustCenterId: TRUST_CENTER_ID }, select: { id: true } });
      if (!c) return { ok: false, errors: { holderId: "Choose one of your contacts" } };
      holder = c.id;
    }
    const data = { ...rest, holderId: holder, holderName: holder ? "" : rest.holderName };
    const row = id
      ? await prisma.certification.update({ where: { id, trustCenterId: TRUST_CENTER_ID }, data, select: { id: true } })
      : await prisma.certification.create({
          data: { ...data, trustCenterId: TRUST_CENTER_ID, sortOrder: await nextSortOrder("certification") },
          select: { id: true },
        });
    revalidateEditor();
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return unexpected(err);
  }
}

export async function deleteCertificationAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await prisma.certification.deleteMany({ where: { id: String(id), trustCenterId: TRUST_CENTER_ID } });
    revalidateEditor();
    return { ok: true, data: undefined };
  } catch (err) {
    return unexpected(err);
  }
}
