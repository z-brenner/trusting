"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Unplug } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { disconnectIntegrationAction } from "@/lib/actions/integrations";

export function DisconnectButton({ provider, label, accountEmail }: { provider: "google" | "microsoft"; label: string; accountEmail: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function disconnect() {
    setPending(true);
    setError(null);
    const result = await disconnectIntegrationAction(provider).catch(() => ({ ok: false, message: "Something went wrong." }));
    setPending(false);
    if (!result.ok) {
      setError(result.message ?? "Could not disconnect.");
      return;
    }
    setOpen(false);
    router.replace(`/admin/integrations?disconnected=${provider}`);
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Unplug className="size-4" aria-hidden="true" />
        Disconnect
      </Button>
      <Dialog
        open={open}
        onClose={() => (pending ? undefined : setOpen(false))}
        title={`Disconnect ${label}?`}
        description={`The stored access for ${accountEmail || "this account"} will be deleted from this server.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={disconnect} loading={pending}>
              Disconnect
            </Button>
          </>
        }
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
          <li>Documents you already imported stay in your Trust Center; they are copies.</li>
          <li>You can connect again at any time, with the same or a different account.</li>
          {provider === "google" ? (
            <li>We also ask Google to revoke the token, so the app disappears from the account&apos;s connected apps.</li>
          ) : (
            <li>Microsoft has no revocation endpoint; you can also remove the app under your Microsoft account&apos;s privacy settings.</li>
          )}
        </ul>
        {error ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </Dialog>
    </>
  );
}
