"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WEEKDAYS, WEEKDAY_LABELS, type Weekday } from "@/lib/supabase/types";
import { completeOnboarding, type OnboardingState } from "./actions";

const SLUGIFY = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const DEFAULT_OPEN_DAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat"];

function FinishButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Setting up your account…" : "Finish setup → enter dashboard"}
    </Button>
  );
}

export function OnboardingForm({
  initialBusinessName,
  initialSuggestedSlug,
  contactEmail,
  publicHostLabel,
}: {
  initialBusinessName: string;
  initialSuggestedSlug: string;
  contactEmail: string;
  publicHostLabel: string;
}) {
  const [state, formAction] = useActionState<OnboardingState, FormData>(
    completeOnboarding,
    {},
  );
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [slug, setSlug] = useState(initialSuggestedSlug);
  const [slugTouched, setSlugTouched] = useState(false);

  // Auto-derive slug from business name until the user types in the slug field.
  useEffect(() => {
    if (!slugTouched) {
      const auto = SLUGIFY(businessName);
      if (auto) setSlug(auto);
    }
  }, [businessName, slugTouched]);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <Section
        step={1}
        title="Confirm your business"
        description="This is the name customers will see on emails and your booking page."
      >
        <Field label="Business name" htmlFor="business_name">
          <Input
            id="business_name"
            name="business_name"
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
          />
          {state.fieldErrors?.business_name && (
            <p className="mt-1 text-xs text-red-700">{state.fieldErrors.business_name}</p>
          )}
        </Field>
      </Section>

      <Section
        step={2}
        title="Choose your public URL"
        description="This is the address you'll share with customers to browse your stock and book viewings."
      >
        <Field label="Your URL" htmlFor="slug">
          <div className="flex items-center gap-1 rounded-md border border-border bg-bg-subtle px-3 focus-within:bg-bg">
            <span className="select-none text-sm text-fg-muted">{publicHostLabel}/d/</span>
            <input
              id="slug"
              name="slug"
              type="text"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(SLUGIFY(e.target.value));
              }}
              required
              minLength={3}
              maxLength={60}
              className="h-9 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          {state.fieldErrors?.slug && (
            <p className="mt-1 text-xs text-red-700">{state.fieldErrors.slug}</p>
          )}
          <p className="mt-1 text-xs text-fg-muted">
            Lowercase letters, numbers and hyphens only.
          </p>
        </Field>
      </Section>

      <Section
        step={3}
        title="Contact + timezone"
        description="Used on booking emails and the public booking page."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Contact email" htmlFor="contact_email_display">
            <Input
              id="contact_email_display"
              type="email"
              value={contactEmail}
              disabled
              readOnly
            />
          </Field>
          <Field label="Contact phone" htmlFor="contact_phone">
            <Input
              id="contact_phone"
              name="contact_phone"
              type="tel"
              autoComplete="tel"
              required
              placeholder="+971 50 123 4567"
            />
            {state.fieldErrors?.contact_phone && (
              <p className="mt-1 text-xs text-red-700">{state.fieldErrors.contact_phone}</p>
            )}
          </Field>
          <Field label="Timezone" htmlFor="timezone">
            <Input
              id="timezone"
              name="timezone"
              defaultValue="Asia/Dubai"
              required
              placeholder="Asia/Dubai"
            />
            <p className="mt-1 text-xs text-fg-muted">
              IANA timezone — e.g. Asia/Dubai, Europe/London.
            </p>
          </Field>
        </div>
      </Section>

      <Section
        step={4}
        title="Working hours"
        description="When customers can book viewings. You can fine-tune per-day later in Settings."
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label className="block">Open days</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => (
                <label
                  key={day}
                  className="flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2 text-sm has-[:checked]:border-fg has-[:checked]:bg-bg-subtle"
                >
                  <input
                    type="checkbox"
                    name="open_days"
                    value={day}
                    defaultChecked={DEFAULT_OPEN_DAYS.includes(day)}
                  />
                  {WEEKDAY_LABELS[day]}
                </label>
              ))}
            </div>
            {state.fieldErrors?.open_days && (
              <p className="mt-1 text-xs text-red-700">{state.fieldErrors.open_days}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Open from" htmlFor="open_start">
              <Input
                id="open_start"
                name="open_start"
                type="time"
                defaultValue="09:00"
                required
              />
            </Field>
            <Field label="Close at" htmlFor="open_end">
              <Input
                id="open_end"
                name="open_end"
                type="time"
                defaultValue="19:00"
                required
              />
              {state.fieldErrors?.open_end && (
                <p className="mt-1 text-xs text-red-700">{state.fieldErrors.open_end}</p>
              )}
            </Field>
          </div>
        </div>
      </Section>

      <Section
        step={5}
        title="Pick a plan"
        description="No credit card needed. We'll remind you before your trial ends."
      >
        <div className="rounded-[12px] border-2 border-fg bg-bg p-5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-semibold">7-day free trial</h3>
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Selected
            </span>
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            Full access to everything: unlimited cars, customers, bookings,
            email reminders. No credit card. After 7 days you can choose to
            continue on a paid plan.
          </p>
        </div>
      </Section>

      <FinishButton />
    </form>
  );
}

function Section({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-8 first:border-t-0 first:pt-0">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Step {step} of 5
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-fg-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
