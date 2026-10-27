"use client";

import { useActionState } from "react";
import { Button, Field, Input, Alert } from "@/components/ui";
import type { FormState } from "@/lib/actions/auth";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function SetupForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state?.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <Field label="Company name" htmlFor="companyName" error={state?.errors?.companyName}>
        <Input id="companyName" name="companyName" autoComplete="organization" required defaultValue={state?.values?.companyName} />
      </Field>
      <Field label="Your name" htmlFor="name" error={state?.errors?.name}>
        <Input id="name" name="name" autoComplete="name" required defaultValue={state?.values?.name} />
      </Field>
      <Field label="Email address" htmlFor="email" error={state?.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
      </Field>
      <Field label="Password" htmlFor="password" help="At least 12 characters." error={state?.errors?.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Create administrator account
      </Button>
    </form>
  );
}

export function LoginForm({ action, next }: { action: Action; next?: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state?.message ? <Alert tone="danger">{state.message}</Alert> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Email address" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus defaultValue={state?.values?.email} />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}
