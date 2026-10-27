import { redirect } from "next/navigation";
import { getSession, isSetupComplete } from "@/lib/auth";
import { loginAction } from "@/lib/actions/auth";
import { LoginForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage(props: { searchParams: Promise<{ next?: string }> }) {
  if (!(await isSetupComplete())) redirect("/setup");
  if (await getSession()) redirect("/admin");
  const { next } = await props.searchParams;
  return (
    <AuthShell title="Sign in" subtitle="Administrator access to your Trust Center.">
      <LoginForm action={loginAction} next={next} />
    </AuthShell>
  );
}
