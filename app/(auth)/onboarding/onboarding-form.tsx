"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WEEKDAYS, WEEKDAY_LABELS, type Weekday } from "@/lib/supabase/types";
import { completeOnboarding, type OnboardingState } from "./actions";

const DEFAULT_OPEN_DAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat"];
const TOTAL_STEPS = 4;

function FinishButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Setting up your account…" : "Continue"}
    </Button>
  );
}

export function OnboardingForm({
  initialBusinessName,
  contactEmail,
}: {
  initialBusinessName: string;
  contactEmail: string;
}) {
  const [state, formAction] = useActionState<OnboardingState, FormData>(
    completeOnboarding,
    {},
  );
  const [businessName, setBusinessName] = useState(initialBusinessName);

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
        step={3}
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
        step={4}
        title="Add your first car (optional)"
        description="Skip this if you're not ready — you can add cars anytime from the dashboard."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Make" htmlFor="car_make">
            <Input
              id="car_make"
              name="car_make"
              type="text"
              placeholder="Toyota"
            />
            {state.fieldErrors?.car_make && (
              <p className="mt-1 text-xs text-red-700">{state.fieldErrors.car_make}</p>
            )}
          </Field>
          <Field label="Model" htmlFor="car_model">
            <Input
              id="car_model"
              name="car_model"
              type="text"
              placeholder="Land Cruiser"
            />
            {state.fieldErrors?.car_model && (
              <p className="mt-1 text-xs text-red-700">{state.fieldErrors.car_model}</p>
            )}
          </Field>
          <Field label="Year" htmlFor="car_year">
            <Input
              id="car_year"
              name="car_year"
              type="number"
              min={1900}
              max={2100}
            />
            {state.fieldErrors?.car_year && (
              <p className="mt-1 text-xs text-red-700">{state.fieldErrors.car_year}</p>
            )}
          </Field>
          <Field label="Price (AED)" htmlFor="car_price_aed">
            <Input
              id="car_price_aed"
              name="car_price_aed"
              type="number"
              min={0}
              step={1}
              placeholder="85000"
            />
            {state.fieldErrors?.car_price_aed && (
              <p className="mt-1 text-xs text-red-700">{state.fieldErrors.car_price_aed}</p>
            )}
          </Field>
          <Field label="Mileage (km)" htmlFor="car_mileage">
            <Input
              id="car_mileage"
              name="car_mileage"
              type="number"
              min={0}
              step={1}
              placeholder="12000"
            />
          </Field>
          <Field label="Colour" htmlFor="car_colour">
            <Input
              id="car_colour"
              name="car_colour"
              type="text"
              placeholder="Pearl White"
            />
          </Field>
          <Field label="Transmission" htmlFor="car_transmission">
            <select
              id="car_transmission"
              name="car_transmission"
              className="h-9 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— select —</option>
              <option value="automatic">Automatic</option>
              <option value="manual">Manual</option>
              <option value="semi_auto">Semi-auto</option>
            </select>
          </Field>
          <Field label="Fuel type" htmlFor="car_fuel_type">
            <select
              id="car_fuel_type"
              name="car_fuel_type"
              className="h-9 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— select —</option>
              <option value="petrol">Petrol</option>
              <option value="diesel">Diesel</option>
              <option value="hybrid">Hybrid</option>
              <option value="electric">Electric</option>
            </select>
          </Field>
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
          Step {step} of {TOTAL_STEPS}
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
