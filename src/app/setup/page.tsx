import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/auth";
import { setupAction } from "@/lib/actions/auth";
import { SetupForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Set up your Trust Center" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await isSetupComplete()) redirect("/login");
  return (
    <AuthShell
      title="Welcome to your Trust Center"
      subtitle="Create the first administrator account. You can add more administrators later in Settings."
    >
      <SetupForm action={setupAction} />
    </AuthShell>
  );
}
