import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env, smtpConfigured, googleConfigured, microsoftConfigured } from "@/lib/env";
import { changePasswordAction } from "@/lib/actions/auth";
import { updateProfileAction, addAdminAction, removeAdminAction, signOutOtherSessionsAction } from "@/lib/actions/settings";
import { AdminContainer, PageHeader } from "@/components/admin/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui";
import { ProfileForm, PasswordForm, AddAdminForm, AdministratorsList, SignOutOthersButton } from "@/components/admin/settings/settings-forms";
import { formatDateTime } from "@/components/admin/dashboard/relative-time";

async function appVersion() {
  try {
    const pkg = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8")) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

export default async function SettingsPage() {
  const session = await requireAdmin();
  const [admins, otherSessions, version] = await Promise.all([
    prisma.adminUser.findMany({
      orderBy: { createdAt: "asc" },
      // Never select password hashes.
      select: { id: true, name: true, email: true, lastLoginAt: true, createdAt: true },
    }),
    prisma.session.count({ where: { userId: session.userId, id: { not: session.id }, expiresAt: { gt: new Date() } } }),
    appVersion(),
  ]);
  const e = env();

  return (
    <AdminContainer className="max-w-4xl">
      <PageHeader title="Settings" description="Your account, the administrators of this Trust Center and how the server is configured." />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Profile" />
          <CardBody>
            <ProfileForm action={updateProfileAction} user={session.user} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Password" description="Changing your password signs you out of other devices." />
          <CardBody>
            <PasswordForm action={changePasswordAction} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Administrators"
            description="Everyone listed here has full access to the Trust Center, documents and requests."
          />
          <AdministratorsList
            admins={admins.map((a) => ({ id: a.id, name: a.name, email: a.email, lastLoginAt: a.lastLoginAt?.toISOString() ?? null }))}
            currentUserId={session.userId}
            removeAction={removeAdminAction}
          />
          <CardBody className="border-t border-line">
            <AddAdminForm action={addAdminAction} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Sessions"
            description={
              otherSessions === 0
                ? "You are signed in on this device only."
                : `You are signed in on ${otherSessions} other ${otherSessions === 1 ? "device" : "devices"}.`
            }
          />
          <CardBody>
            <SignOutOthersButton action={signOutOtherSessionsAction} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="System information" description="Read-only. Change these through environment variables." />
          <CardBody>
            <dl className="grid gap-x-6 gap-y-5 text-sm sm:grid-cols-2">
              <Info label="Public URL">
                <code className="font-mono text-[13px]">{e.APP_URL}</code>
              </Info>
              <Info label="App version">{version}</Info>
              <Info label="Storage">{e.STORAGE_DRIVER === "s3" ? `S3-compatible (${e.S3_BUCKET ?? "bucket"})` : "Local disk"}</Info>
              <Info label="Upload limit">{e.MAX_UPLOAD_MB} MB per file</Info>
              <Info label="Email (SMTP)">
                <YesNo value={smtpConfigured()} yes="Configured" no="Not configured — approval links must be sent manually" />
              </Info>
              <Info label="Google Drive">
                <YesNo value={googleConfigured()} />
              </Info>
              <Info label="OneDrive">
                <YesNo value={microsoftConfigured()} />
              </Info>
              <Info label="Server time">{formatDateTime(new Date())}</Info>
            </dl>
          </CardBody>
        </Card>
      </div>
    </AdminContainer>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1.5 text-ink">{children}</dd>
    </div>
  );
}

function YesNo({ value, yes = "Configured", no = "Not configured" }: { value: boolean; yes?: string; no?: string }) {
  return <span className={value ? "text-success" : "text-ink-muted"}>{value ? yes : no}</span>;
}
