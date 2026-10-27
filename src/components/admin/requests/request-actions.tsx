"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Textarea, Alert, Card, CardHeader, CardBody } from "@/components/ui";
import { CopyButton } from "@/components/admin/dashboard/status-card";
import {
  approveRequestAction,
  rejectRequestAction,
  revokeRequestAction,
  regenerateGrantLinkAction,
  type RequestActionState,
} from "@/lib/actions/requests";
import { formatLongDate } from "@/components/admin/dashboard/relative-time";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";

/**
 * Shows the grant link exactly once. The server stores only a hash of the
 * token, so once this component unmounts the link is gone for good.
 */
function OneTimeLink({ state }: { state: RequestActionState }) {
  if (!state?.ok || !state.link) return null;
  const expiry = state.expiresAt ? formatLongDate(state.expiresAt) : null;
  return (
    <Alert tone={state.emailed ? "success" : "warning"} title={state.emailed ? "Approved and emailed" : "Approved — send the link yourself"}>
      <div className="space-y-2">
        <p>
          {state.emailed
            ? `The requester received an email with their access link${expiry ? ` (expires ${expiry})` : ""}. Keep a copy below in case they need it again.`
            : state.emailError
              ? "Sending the email failed. Copy the link below and send it to the requester yourself."
              : "Email is not configured on this server, so the link was not sent. Copy it now and send it to the requester yourself."}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-[13px] text-ink">
            {state.link}
          </code>
          <CopyButton value={state.link} label="Copy link" />
        </div>
        <p className="text-[13px] font-medium text-warning">
          This link is shown only once and cannot be recovered later. If you lose it, generate a new one.
          {expiry ? ` It expires on ${expiry}.` : ""}
        </p>
      </div>
    </Alert>
  );
}

/**
 * All decision controls for one request. Kept as a single always-mounted
 * component so the one-time link survives router.refresh() when the request
 * flips from pending to approved.
 */
export function RequestActions({
  requestId,
  status,
  defaultDays,
  grantableCount,
}: {
  requestId: string;
  status: Status;
  defaultDays: number;
  grantableCount: number;
}) {
  const router = useRouter();
  const [issued, setIssued] = React.useState<RequestActionState>(undefined);
  const [revokeState, setRevokeState] = React.useState<RequestActionState>(undefined);
  const [revoking, setRevoking] = React.useState(false);

  // Remember the most recently issued link; it must outlive the refresh that follows.
  function remember(result: RequestActionState) {
    if (result?.ok && result.link) {
      setIssued(result);
      setRevokeState(undefined);
    }
    if (result?.ok) router.refresh();
    return result;
  }

  const [approveState, approveAction, approvePending] = useActionState(
    async (prev: RequestActionState, formData: FormData) => remember(await approveRequestAction(requestId, prev, formData)),
    undefined,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    async (prev: RequestActionState, formData: FormData) => remember(await rejectRequestAction(requestId, prev, formData)),
    undefined,
  );
  const [regenState, regenAction, regenPending] = useActionState(
    async (prev: RequestActionState, formData: FormData) => remember(await regenerateGrantLinkAction(requestId, prev, formData)),
    undefined,
  );

  async function onRevoke() {
    if (!window.confirm("Revoke access? The link stops working immediately and cannot be restored.")) return;
    setRevoking(true);
    const result = await revokeRequestAction(requestId);
    setRevoking(false);
    setRevokeState(result);
    setIssued(undefined);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {issued ? <OneTimeLink state={issued} /> : null}
      {revokeState?.message ? <Alert tone={revokeState.ok ? "info" : "danger"}>{revokeState.message}</Alert> : null}
      {rejectState?.ok ? (
        <Alert tone="info" title="Request rejected">
          {rejectState.emailed
            ? "The requester has been notified by email."
            : rejectState.emailError
              ? "Sending the notification email failed. You may want to inform the requester yourself."
              : "Email is not configured, so the requester was not notified automatically."}
        </Alert>
      ) : null}

      {status === "PENDING" && !approveState?.ok && !rejectState?.ok ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card id="approve">
            <CardHeader title="Approve" description="Issue a time-limited link to the requested documents." />
            <CardBody>
              <form action={approveAction} className="space-y-4" noValidate>
                {approveState?.message ? <Alert tone="danger">{approveState.message}</Alert> : null}
                <Field label="Link valid for (days)" htmlFor="expiryDays" help="Between 1 and 90 days." error={approveState?.errors?.expiryDays}>
                  <Input id="expiryDays" name="expiryDays" type="number" min={1} max={90} defaultValue={defaultDays} className="w-32" required />
                </Field>
                <Field label="Internal note" htmlFor="note" optional help="Only visible to administrators.">
                  <Textarea id="note" name="note" maxLength={2000} className="min-h-16" />
                </Field>
                <Button type="submit" loading={approvePending} disabled={grantableCount === 0 || rejectPending}>
                  Approve and send link
                </Button>
              </form>
            </CardBody>
          </Card>

          <Card id="reject">
            <CardHeader title="Reject" description="The requester is told their request was not approved." />
            <CardBody>
              <form action={rejectAction} className="space-y-4" noValidate>
                {rejectState?.message ? <Alert tone="danger">{rejectState.message}</Alert> : null}
                <Field label="Reason" htmlFor="reason" optional help="Included in the email to the requester." error={rejectState?.errors?.reason}>
                  <Textarea id="reason" name="reason" maxLength={2000} className="min-h-16" />
                </Field>
                <Button type="submit" variant="secondary" loading={rejectPending} disabled={approvePending}>
                  Reject request
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {status === "APPROVED" ? (
        <Card>
          <CardHeader
            title="Access link"
            description="Only a hash of the link is stored. If the requester lost it, generate a new one; the old link stops working."
          />
          <CardBody>
            <form action={regenAction} className="space-y-3" noValidate>
              {regenState?.message ? <Alert tone="danger">{regenState.message}</Alert> : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Field label="New link valid for (days)" htmlFor="regen-days" error={regenState?.errors?.expiryDays} className="sm:w-48">
                  <Input id="regen-days" name="expiryDays" type="number" min={1} max={90} defaultValue={defaultDays} required />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" variant="secondary" loading={regenPending} disabled={grantableCount === 0}>
                    Generate a new link
                  </Button>
                  <Button type="button" variant="danger" onClick={onRevoke} loading={revoking}>
                    Revoke access
                  </Button>
                </div>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
