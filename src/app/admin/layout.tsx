import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { logoutAction } from "@/lib/actions/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AdminNav user={session.user} logoutAction={logoutAction} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
