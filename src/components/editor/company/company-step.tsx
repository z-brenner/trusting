"use client";

import * as React from "react";
import { Field, FormSection } from "@/components/ui/field";
import { Input, Switch, Textarea } from "@/components/ui/input";
import { saveCompanyAction } from "@/lib/actions/editor";
import type { CompanyInput } from "@/lib/validation";
import { StepFooter } from "../step-footer";
import { WelcomeBanner } from "../welcome-banner";
import { useTrackedAction, useWizard } from "../wizard-context";
import { ColorField } from "./color-field";
import { LogoUploader } from "./logo-uploader";

export type CompanyFormValues = CompanyInput;

const AUTOSAVE_MS = 800;

export function CompanyStep({ initial, hasLogo }: { initial: CompanyFormValues; hasLogo: boolean }) {
  const { registerBeforeContinue, bumpPreview } = useWizard();
  const tracked = useTrackedAction();
  const [values, setValues] = React.useState<CompanyFormValues>(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const latest = React.useRef(values);
  const dirty = React.useRef(false);
  const timer = React.useRef<number | null>(null);
  const inflight = React.useRef<Promise<boolean> | null>(null);
  const hasErrors = React.useRef(false);

  const save = React.useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirty.current) return !hasErrors.current;
    dirty.current = false;
    const snapshot = latest.current;
    const run = (async () => {
      const result = await tracked(() => saveCompanyAction(snapshot));
      // Only apply the outcome if nothing changed meanwhile; a newer save will follow.
      if (latest.current === snapshot || !dirty.current) {
        const next = result.ok ? {} : (result.errors ?? { _: result.message ?? "Could not save" });
        hasErrors.current = Object.keys(next).length > 0;
        setErrors(next);
      }
      return result.ok;
    })();
    inflight.current = run;
    try {
      return await run;
    } finally {
      if (inflight.current === run) inflight.current = null;
    }
  }, [tracked]);

  const update = React.useCallback(
    (patch: Partial<CompanyFormValues>) => {
      setValues((prev) => {
        const next = { ...prev, ...patch };
        latest.current = next;
        return next;
      });
      dirty.current = true;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void save(), AUTOSAVE_MS);
    },
    [save],
  );

  // Continue flushes any pending autosave and only advances when the data is valid.
  React.useEffect(() => {
    registerBeforeContinue(async () => {
      if (inflight.current) await inflight.current;
      const ok = await save();
      return ok;
    });
    return () => registerBeforeContinue(null);
  }, [registerBeforeContinue, save]);

  // Never lose typed input: warn before leaving while a save is still pending.
  React.useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current || inflight.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const field = (name: keyof CompanyFormValues) => ({
    id: `company-${name}`,
    value: String(values[name] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update({ [name]: e.target.value }),
    "aria-invalid": errors[name] ? true : undefined,
  });

  const defaultTitle = values.companyName.trim() ? `${values.companyName.trim()} Trust Center` : "Trust Center";

  return (
    <div className="space-y-10">
      <WelcomeBanner companyName={initial.companyName} />

      {errors._ ? (
        <p className="text-sm text-danger" role="alert">
          {errors._}
        </p>
      ) : null}

      <FormSection title="Basics" description="How your organisation is introduced at the top of the page.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Company name" htmlFor="company-companyName" error={errors.companyName}>
            <Input {...field("companyName")} autoComplete="organization" placeholder="Acme Analytics" />
          </Field>
          <Field label="Legal name" htmlFor="company-legalName" optional error={errors.legalName} help="Shown in the footer, e.g. “Acme Analytics GmbH”.">
            <Input {...field("legalName")} placeholder="Acme Analytics GmbH" />
          </Field>
        </div>
        <Field label="Trust Center title" htmlFor="company-title" error={errors.title} help={`Leave blank to use “${defaultTitle}”.`}>
          <Input {...field("title")} placeholder={defaultTitle} />
        </Field>
        <Field label="Tagline" htmlFor="company-tagline" optional error={errors.tagline} help="One sentence under the title.">
          <Input {...field("tagline")} placeholder="Security and privacy you can verify." />
        </Field>
        <Field
          label="Introduction"
          htmlFor="company-description"
          optional
          error={errors.description}
          help="Plain text. Separate paragraphs with a blank line."
        >
          <Textarea
            {...field("description")}
            rows={6}
            placeholder={"Explain how you protect customer data, who is responsible for security and how to get in touch.\n\nA second paragraph can cover your approach to compliance."}
          />
        </Field>
      </FormSection>

      <FormSection title="Website and logo">
        <Field label="Website" htmlFor="company-websiteUrl" optional error={errors.websiteUrl} help="Linked from your logo and footer.">
          <Input {...field("websiteUrl")} type="url" inputMode="url" placeholder="https://www.example.com" />
        </Field>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-ink">Logo</span>
          <LogoUploader initialUrl={hasLogo ? `/api/logo?v=${initial.companyName.length}` : null} onChange={() => bumpPreview()} />
        </div>
      </FormSection>

      <FormSection title="Brand colours" description="Used for the header band, badges and links on the public page. Keep the primary colour dark enough for white text.">
        <div className="grid gap-5 sm:grid-cols-2">
          <ColorField id="company-primaryColor" label="Primary colour" value={values.primaryColor} onChange={(hex) => update({ primaryColor: hex })} error={errors.primaryColor} />
          <ColorField id="company-secondaryColor" label="Secondary colour" value={values.secondaryColor} onChange={(hex) => update({ secondaryColor: hex })} error={errors.secondaryColor} help="Accents such as status markers." />
        </div>
      </FormSection>

      <FormSection title="Company details" description="Optional details some customers ask for during vendor reviews.">
        <Field label="Address" htmlFor="company-address" optional error={errors.address}>
          <Textarea {...field("address")} rows={2} className="min-h-0" placeholder={"Example Street 1\n10115 Berlin, Germany"} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Registration number" htmlFor="company-registrationNumber" optional error={errors.registrationNumber}>
            <Input {...field("registrationNumber")} placeholder="HRB 123456" />
          </Field>
          <Field label="Industry" htmlFor="company-industry" optional error={errors.industry}>
            <Input {...field("industry")} placeholder="Software" />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Public contact" description="A general security or privacy mailbox visitors can write to. Named contacts come in step 4.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email" htmlFor="company-contactEmail" optional error={errors.contactEmail}>
            <Input {...field("contactEmail")} type="email" inputMode="email" placeholder="security@example.com" />
          </Field>
          <Field label="Phone" htmlFor="company-contactPhone" optional error={errors.contactPhone}>
            <Input {...field("contactPhone")} type="tel" inputMode="tel" placeholder="+49 30 1234567" />
          </Field>
        </div>
        <Field label="Note" htmlFor="company-contactNote" optional error={errors.contactNote} help="For example response times or PGP key details.">
          <Textarea {...field("contactNote")} rows={2} className="min-h-0" placeholder="We answer security questions within two business days." />
        </Field>
      </FormSection>

      <FormSection title="Map">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-line bg-surface px-4 py-3">
          <div>
            <label htmlFor="company-showMap" className="block text-sm font-medium text-ink">
              Show the processing-locations map
            </label>
            <p className="mt-0.5 text-[13px] text-ink-muted">A world map highlighting where your subprocessors process data.</p>
          </div>
          <Switch id="company-showMap" checked={values.showMap} onChange={(checked) => update({ showMap: checked })} label="Show the processing-locations map" />
        </div>
      </FormSection>

      <StepFooter />
    </div>
  );
}
