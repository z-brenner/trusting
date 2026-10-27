"use client";

import * as React from "react";
import { useActionState } from "react";
import { Button, Field, Input, Alert, Badge } from "@/components/ui";
import { relativeTime } from "@/components/admin/dashboard/relative-time";
import type { FormState } from "@/lib/actions/auth";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function Feedback({ state }: { state: FormState }) {
  if (!state?.message) return null;
  return <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>;
}

export function ProfileForm({ action, user }: { action: Action; user: { name: string; email: string } }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="profile-name" error={state?.errors?.name}>
          <Input id="profile-name" name="name" autoComplete="name" required defaultValue={state?.values?.name ?? user.name} />
        </Field>
        <Field label="Email address" htmlFor="profile-email" error={state?.errors?.email} help="Used to sign in.">
          <Input id="profile-email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email ?? user.email} />
        </Field>
      </div>
      <Button type="submit" variant="secondary" loading={pending}>
        Save profile
      </Button>
    </form>
  );
}

export function PasswordForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      <Feedback state={state} />
      <Field label="Current password" htmlFor="currentPassword" error={state?.errors?.currentPassword}>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" htmlFor="newPassword" help="At least 12 characters." error={state?.errors?.newPassword}>
          <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={12} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirmPassword" error={state?.errors?.confirmPassword}>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} />
        </Field>
      </div>
      <Button type="submit" variant="secondary" loading={pending}>
        Change password
      </Button>
    </form>
  );
}

export function AddAdminForm({ action }: { action: Action }) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result?.ok) setOpen(false);
    return result;
  }, undefined);

  return (
    <div className="space-y-3">
      <Feedback state={state} />
      {!open ? (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Add administrator
        </Button>
      ) : (
        <form action={formAction} className="space-y-4 rounded-lg border border-line bg-surface-muted p-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="admin-name" error={state?.errors?.name}>
              <Input id="admin-name" name="name" required defaultValue={state?.values?.name} />
            </Field>
            <Field label="Email address" htmlFor="admin-email" error={state?.errors?.email}>
              <Input id="admin-email" name="email" type="email" required defaultValue={state?.values?.email} />
            </Field>
          </div>
          <Field
            label="Temporary password"
            htmlFor="admin-password"
            help="At least 12 characters. Share it securely and ask them to change it after signing in."
            error={state?.errors?.password}
          >
            <Input id="admin-password" name="password" type="password" autoComplete="off" required minLength={12} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={pending}>
              Create account
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function AdministratorsList({
  admins,
  currentUserId,
  removeAction,
}: {
  admins: { id: string; name: string; email: string; lastLoginAt: string | null }[];
  currentUserId: string;
  removeAction: Action;
}) {
  // One shared state so the outcome survives the removed row disappearing.
  const [state, formAction, pending] = useActionState(removeAction, undefined);
  return (
    <div>
      {state?.message ? (
        <div className="px-5 pt-4">
          <Feedback state={state} />
        </div>
      ) : null}
      <ul className="divide-y divide-line">
        {admins.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <span className="truncate">{a.name}</span>
                {a.id === currentUserId ? <Badge tone="info">You</Badge> : null}
              </p>
              <p className="truncate text-[13px] text-ink-muted">
                {a.email} · {a.lastLoginAt ? `Last sign-in ${relativeTime(a.lastLoginAt)}` : "Never signed in"}
              </p>
            </div>
            {a.id !== currentUserId ? (
              <form
                action={formAction}
                onSubmit={(e) => {
                  if (!window.confirm(`Remove ${a.name}? They will be signed out everywhere and can no longer sign in.`)) e.preventDefault();
                }}
              >
                <input type="hidden" name="userId" value={a.id} />
                <Button type="submit" variant="ghost" size="sm" disabled={pending} className="hover:text-danger">
                  Remove
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SignOutOthersButton({ action }: { action: () => Promise<FormState> }) {
  const [state, setState] = React.useState<FormState>(undefined);
  const [pending, setPending] = React.useState(false);
  return (
    <div className="space-y-3">
      <Feedback state={state} />
      <Button
        variant="secondary"
        size="sm"
        loading={pending}
        onClick={async () => {
          setPending(true);
          setState(await action());
          setPending(false);
        }}
      >
        Sign out of all other devices
      </Button>
    </div>
  );
}
