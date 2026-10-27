import { AdminContainer, PageHeader } from "@/components/admin/page-header";

export default function AdminHome() {
  return (
    <AdminContainer>
      <PageHeader title="Overview" />
      <p className="text-sm text-ink-muted">Dashboard coming up.</p>
    </AdminContainer>
  );
}
