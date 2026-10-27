"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Alert } from "@/components/ui";
import { PROVIDER_LABELS } from "./provider-icon";

type ProviderKey = "google" | "microsoft";

const ERROR_MESSAGES: Record<string, (label: string) => { title: string; body: string }> = {
  state: () => ({
    title: "The sign-in could not be verified",
    body: "The link expired (it is valid for 10 minutes), was opened in a different browser, or was tampered with. Start the connection again from this page.",
  }),
  denied: (label) => ({
    title: "Access was not granted",
    body: `You cancelled the ${label} authorisation or declined the requested access. Nothing was connected.`,
  }),
  exchange: (label) => ({
    title: `${label} did not accept the authorisation`,
    body: "The authorisation code could not be exchanged for tokens. Check the client ID, client secret and the registered redirect URI, then try again.",
  }),
  account: (label) => ({
    title: "Account details could not be read",
    body: `${label} authorised the connection but did not return the account's name and email address. Try connecting again.`,
  }),
  session: () => ({
    title: "Your session ended during the connection",
    body: "You were signed out while authorising. Now that you are signed in again, start the connection once more.",
  }),
  provider: (label) => ({
    title: `${label} returned an error`,
    body: "The provider reported a problem during authorisation. Try again in a moment; if it persists, check the integration's setup guide.",
  }),
};

export function IntegrationBanners({
  connected,
  disconnected,
  error,
  provider,
}: {
  connected?: string;
  disconnected?: string;
  error?: string;
  provider?: string;
}) {
  const router = useRouter();
  const label = provider && provider in PROVIDER_LABELS ? PROVIDER_LABELS[provider as ProviderKey] : "The provider";
  const dismiss = () => router.replace("/admin/integrations");

  let content: { tone: "success" | "danger"; title: string; body: string } | null = null;
  if (connected && connected in PROVIDER_LABELS) {
    content = {
      tone: "success",
      title: `${PROVIDER_LABELS[connected as ProviderKey]} connected`,
      body: "You can now import files from the Documents page. Imported documents are private until you change their visibility.",
    };
  } else if (disconnected && disconnected in PROVIDER_LABELS) {
    content = {
      tone: "success",
      title: `${PROVIDER_LABELS[disconnected as ProviderKey]} disconnected`,
      body: "The stored tokens were deleted. Documents you imported earlier are unaffected.",
    };
  } else if (error) {
    const build = ERROR_MESSAGES[error] ?? ERROR_MESSAGES.provider;
    const { title, body } = build(label);
    content = { tone: "danger", title, body };
  }
  if (!content) return null;

  return (
    <div className="relative mb-6">
      <Alert tone={content.tone} title={content.title} className="pr-10">
        {content.body}
      </Alert>
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-2.5 right-2.5 rounded-md p-1 text-ink-faint hover:bg-surface hover:text-ink"
        aria-label="Dismiss"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
