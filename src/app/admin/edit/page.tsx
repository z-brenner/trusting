import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getDraft } from "@/lib/trust-center";
import { clampStep } from "@/components/editor/steps";

export const dynamic = "force-dynamic";

/** Resume the guided editor at the step the administrator last worked on. */
export default async function EditIndexPage() {
  await requireAdmin();
  const draft = await getDraft();
  redirect(`/admin/edit/${clampStep(draft.wizardStep)}`);
}
