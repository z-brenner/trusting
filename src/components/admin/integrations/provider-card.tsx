import Link from "next/link";
import { ArrowRight, BookOpen, Check, FileText } from "lucide-react";
import { Badge, Card, buttonClasses } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { CopyButton } from "./copy-button";
import { DisconnectButton } from "./disconnect-button";
import { ProviderIcon } from "./provider-icon";

export type ProviderCardProps = {
  provider: "google" | "microsoft";
  label: string;
  configured: boolean;
  redirectUri: string;
  docsPath: string;
  scopeDescriptions: string[];
  connection: {
    accountEmail: string;
    accountName: string;
    connectedAt: Date;
    scopes: string;
  } | null;
};

const ENV_VARS: Record<"google" | "microsoft", string[]> = {
  google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  microsoft: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_TENANT (optional)"],
};

const DESCRIPTIONS: Record<"google" | "microsoft", string> = {
  google: "Import policies, reports and certificates from a Google Drive account, including Google Docs, Sheets and Slides (exported as PDF).",
  microsoft: "Import policies, reports and certificates from a personal or work OneDrive account.",
};

export function ProviderCard(props: ProviderCardProps) {
  const { provider, label, configured, connection } = props;
  const status = !configured
    ? { tone: "neutral" as const, text: "Not configured" }
    : connection
      ? { tone: "success" as const, text: "Connected" }
      : { tone: "warning" as const, text: "Not connected" };

  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-4 border-b border-line px-5 py-4">
        <ProviderIcon provider={provider} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold text-ink">{label}</h2>
            <Badge tone={status.tone}>{status.text}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-ink-muted">{DESCRIPTIONS[provider]}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 px-5 py-4">
        {!configured ? <NotConfigured {...props} /> : connection ? <Connected {...props} connection={connection} /> : <NotConnected {...props} />}
      </div>
    </Card>
  );
}

function NotConfigured({ provider, label, redirectUri, docsPath }: ProviderCardProps) {
  return (
    <>
      <p className="text-sm text-ink-muted">
        This server has no OAuth client for {label}. Create one in your own {provider === "google" ? "Google Cloud project" : "Microsoft Entra tenant"},
        then set {joinCodes(ENV_VARS[provider])} in the server environment and restart. Nothing else is shared with
        {" "}
        {provider === "google" ? "Google" : "Microsoft"}.
      </p>
      <RedirectUri value={redirectUri} />
      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <BookOpen className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Step-by-step instructions: <code className="rounded bg-neutral-soft px-1.5 py-0.5 text-[13px] text-ink">{docsPath}</code> in the
          repository.
        </span>
      </p>
    </>
  );
}

function NotConnected({ provider, label, redirectUri, scopeDescriptions }: ProviderCardProps) {
  return (
    <>
      <p className="text-sm text-ink-muted">
        Connect the {label} account that holds the documents you want to import. You will be sent to{" "}
        {provider === "google" ? "Google" : "Microsoft"} to approve read-only access and come straight back here.
      </p>
      <ScopeList items={scopeDescriptions} />
      <RedirectUri value={redirectUri} compact />
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
        <a href={`/api/integrations/${provider}/start`} className={buttonClasses("primary", "md")}>
          Connect {label}
          <ArrowRight className="size-4" aria-hidden="true" />
        </a>
      </div>
    </>
  );
}

function Connected({ provider, label, scopeDescriptions, connection }: ProviderCardProps & { connection: NonNullable<ProviderCardProps["connection"]> }) {
  const who = connection.accountName && connection.accountName !== connection.accountEmail
    ? `${connection.accountName} (${connection.accountEmail})`
    : connection.accountEmail || connection.accountName || "an unnamed account";
  return (
    <>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
        <dt className="text-ink-muted">Connected as</dt>
        <dd className="font-medium break-words text-ink">{who}</dd>
        <dt className="text-ink-muted">Since</dt>
        <dd className="text-ink">{formatDate(connection.connectedAt, { hour: "2-digit", minute: "2-digit" })}</dd>
      </dl>
      <ScopeList items={scopeDescriptions} title="What this connection can do" />
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
        <Link href="/admin/documents" className={buttonClasses("primary", "md")}>
          <FileText className="size-4" aria-hidden="true" />
          Import documents
        </Link>
        <DisconnectButton provider={provider} label={label} accountEmail={connection.accountEmail} />
      </div>
    </>
  );
}

function ScopeList({ items, title = "Access you will be asked to grant" }: { items: string[]; title?: string }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-ink-faint uppercase">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-ink">
            <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RedirectUri({ value, compact }: { value: string; compact?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-ink-faint uppercase">
        {compact ? "Registered redirect URI" : "Redirect URI to register"}
      </p>
      <div className="mt-1.5 flex items-center gap-2 rounded-md border border-line bg-surface-muted py-1.5 pr-1.5 pl-3">
        <code className="min-w-0 flex-1 truncate text-[13px] text-ink" title={value}>
          {value}
        </code>
        <CopyButton value={value} />
      </div>
      {!compact ? (
        <p className="mt-1.5 text-[13px] text-ink-muted">
          It is derived from <code className="text-ink">APP_URL</code>; it must match the OAuth client exactly, including https.
        </p>
      ) : null}
    </div>
  );
}

function joinCodes(names: string[]) {
  return names.map((n, i) => (
    <span key={n}>
      {i > 0 ? (i === names.length - 1 ? " and " : ", ") : ""}
      <code className="rounded bg-neutral-soft px-1.5 py-0.5 text-[13px] text-ink">{n}</code>
    </span>
  ));
}
