import type { Metadata } from "next";
import { Lock, ShieldCheck, UserCheck } from "lucide-react";
import { AdminContainer, PageHeader } from "@/components/admin/page-header";
import { IntegrationBanners } from "@/components/admin/integrations/integration-banners";
import { ProviderCard } from "@/components/admin/integrations/provider-card";
import { Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { listIntegrationStatus } from "@/lib/integrations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Integrations" };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await searchParams;
  const statuses = await listIntegrationStatus();

  return (
    <AdminContainer>
      <PageHeader
        title="Integrations"
        description="Connect the cloud storage where your policies and reports already live, then import them from the Documents page."
      />
      <IntegrationBanners
        connected={first(sp.connected)}
        disconnected={first(sp.disconnected)}
        error={first(sp.error)}
        provider={first(sp.provider)}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {statuses.map((s) => (
          <ProviderCard
            key={s.key}
            provider={s.key}
            label={s.label}
            configured={s.configured}
            redirectUri={s.redirectUri}
            docsPath={s.docsPath}
            scopeDescriptions={s.scopeDescriptions}
            connection={s.connection}
          />
        ))}
      </div>

      <Card className="mt-6">
        <div className="flex items-start gap-4 px-5 py-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-success-soft text-success" aria-hidden="true">
            <ShieldCheck className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink">How your files are handled</h2>
            <ul className="mt-2 grid gap-2 text-sm text-ink-muted sm:grid-cols-3 sm:gap-6">
              <li className="flex items-start gap-2">
                <UserCheck className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
                <span>Nothing is synchronised. A file is copied only when an administrator explicitly imports it.</span>
              </li>
              <li className="flex items-start gap-2">
                <Lock className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
                <span>Imported documents are always private until an administrator changes their visibility.</span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
                <span>Access tokens are stored encrypted (AES-256-GCM) and are deleted when you disconnect.</span>
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </AdminContainer>
  );
}
