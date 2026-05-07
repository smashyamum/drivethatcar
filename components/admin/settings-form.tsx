"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  REMINDER_OFFSET_PRESETS,
  WEEKDAYS,
  WEEKDAY_LABELS,
  type Settings,
} from "@/lib/supabase/types";
import { saveSettings, type SettingsState } from "@/app/(admin)/admin/settings/actions";

type EmailTier = "none" | "shared" | "custom";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save settings"}
    </Button>
  );
}

/** Pulls the local part out of "bobs-motors@drivethatcar.app" → "bobs-motors". */
function localPartOf(fullEmail: string | null, platformDomain: string): string {
  if (!fullEmail) return "";
  const at = fullEmail.indexOf("@");
  if (at < 0) return "";
  const local = fullEmail.slice(0, at).toLowerCase();
  const domain = fullEmail.slice(at + 1).toLowerCase();
  // Only show a local part if it's actually on the platform domain — if
  // a legacy custom domain is stored, blank the field so the dealer picks
  // a fresh local part on save.
  return domain === platformDomain.toLowerCase() ? local : "";
}

export function SettingsForm({
  initial,
  emailTier,
  platformSender,
  platformDomain,
}: {
  initial: Settings;
  emailTier: EmailTier;
  platformSender: string;
  platformDomain: string;
}) {
  const currentLocalPart = localPartOf(initial.resend_from_email, platformDomain);
  const [state, formAction] = useActionState<SettingsState, FormData>(saveSettings, {});

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Settings saved.
        </p>
      )}

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Business</h2>
          <p className="text-sm text-fg-muted">Shown on confirmation emails (M4) and the public site.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Business name" htmlFor="business_name">
            <Input id="business_name" name="business_name" defaultValue={initial.business_name ?? ""} />
          </Field>
          <Field label="Contact email" htmlFor="contact_email">
            <Input id="contact_email" name="contact_email" type="email" defaultValue={initial.contact_email ?? ""} />
          </Field>
          <Field label="Contact phone" htmlFor="contact_phone">
            <Input id="contact_phone" name="contact_phone" defaultValue={initial.contact_phone ?? ""} placeholder="+971..." />
          </Field>
          <Field label="Timezone" htmlFor="timezone">
            <Input id="timezone" name="timezone" defaultValue={initial.timezone} />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Customer emails</h2>
            <p className="text-sm text-fg-muted">
              Sender for booking confirmations, reminders, cancellations and reschedule notices.
            </p>
          </div>
          {emailTier === "custom" && (
            <span className="rounded-full bg-fg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bg">
              Pro
            </span>
          )}
        </div>

        {emailTier === "none" && (
          <div className="flex flex-col gap-3 rounded-md border border-border bg-bg-subtle p-4 text-sm">
            <p className="text-fg-muted">
              Customer emails aren&rsquo;t included on the Free plan. Customers won&rsquo;t get
              booking confirmations or reminders.
            </p>
            <div>
              <Link
                href="/admin/settings/billing"
                className="inline-flex items-center justify-center rounded-md bg-fg px-3 py-1.5 text-xs font-semibold text-bg hover:opacity-90"
              >
                Upgrade to enable
              </Link>
            </div>
            {/* Submit a blank value so server-side validation still passes. */}
            <input type="hidden" name="resend_from_email" value="" />
          </div>
        )}

        {emailTier === "shared" && (
          <div className="flex flex-col gap-3 rounded-md border border-border bg-bg-subtle p-4 text-sm">
            <p className="text-fg-muted">
              Sent from{" "}
              <code className="font-mono text-[12px] text-fg">{platformSender}</code> on the
              Starter plan.
            </p>
            <p className="text-xs text-fg-muted">
              Want emails to come from your own domain (e.g.{" "}
              <code className="font-mono text-[12px]">bookings@yourdealership.com</code>)?{" "}
              <Link
                href="/admin/settings/billing"
                className="font-medium text-fg hover:underline"
              >
                Upgrade to Pro
              </Link>{" "}
              to use a custom sender.
            </p>
            {/* Always submit blank so settings.resend_from_email stays unset on Starter. */}
            <input type="hidden" name="resend_from_email" value="" />
          </div>
        )}

        {emailTier === "custom" && (
          <Field label="Your sender name" htmlFor="email_local_part">
            <div className="flex flex-wrap items-stretch">
              <Input
                id="email_local_part"
                name="email_local_part"
                defaultValue={currentLocalPart}
                placeholder="bobs-motors"
                pattern="^[a-z0-9]+(?:[._-][a-z0-9]+)*$"
                minLength={3}
                maxLength={32}
                className="rounded-r-none"
              />
              <span className="inline-flex items-center rounded-r-md border border-l-0 border-border bg-bg-subtle px-3 text-sm text-fg-muted">
                @{platformDomain}
              </span>
            </div>
            <p className="text-xs text-fg-muted">
              Customer emails will come from{" "}
              <code className="font-mono text-[12px] text-fg">
                yourname@{platformDomain}
              </code>
              . 3–32 characters, lowercase letters, numbers, dots and dashes only. Leave
              blank to use the platform default ({platformSender}).
            </p>
          </Field>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Reminders</h2>
          <p className="text-sm text-fg-muted">
            When to email customers before their booking. Sent during the daily 08:00 UTC check, so
            actual delivery happens within 24 hours of each chosen time.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {REMINDER_OFFSET_PRESETS.map((preset) => {
            const checked = (initial.reminder_offsets_hours ?? [24]).includes(preset.hours);
            return (
              <label
                key={preset.hours}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm hover:bg-bg-subtle"
              >
                <input
                  type="checkbox"
                  name={`reminder_${preset.hours}`}
                  defaultChecked={checked}
                  className="h-4 w-4 rounded border-border-strong"
                />
                <span>{preset.label}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Slot rules</h2>
          <p className="text-sm text-fg-muted">Length of each viewing/test drive and buffer between them.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Slot length (minutes)" htmlFor="slot_duration_minutes">
            <Select id="slot_duration_minutes" name="slot_duration_minutes" defaultValue={initial.slot_duration_minutes}>
              <option value={30}>30</option>
              <option value={45}>45</option>
              <option value={60}>60</option>
              <option value={90}>90</option>
              <option value={120}>120</option>
            </Select>
          </Field>
          <Field label="Buffer between bookings (minutes)" htmlFor="buffer_minutes">
            <Select id="buffer_minutes" name="buffer_minutes" defaultValue={initial.buffer_minutes}>
              <option value={0}>0 (back-to-back)</option>
              <option value={15}>15</option>
              <option value={30}>30</option>
            </Select>
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Working hours</h2>
          <p className="text-sm text-fg-muted">Untick a day to close it. v1 supports one window per day.</p>
        </div>
        <div className="overflow-hidden rounded-[12px] border border-border">
          <table className="w-full text-sm">
            <thead className="bg-bg-subtle text-left text-xs uppercase tracking-wide text-fg-muted">
              <tr>
                <th className="px-4 py-3">Day</th>
                <th className="px-4 py-3">Open</th>
                <th className="px-4 py-3">Opens at</th>
                <th className="px-4 py-3">Closes at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {WEEKDAYS.map((day) => {
                const window = initial.working_hours[day]?.[0];
                const isOpen = !!window;
                return (
                  <tr key={day}>
                    <td className="px-4 py-3 font-medium">{WEEKDAY_LABELS[day]}</td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        name={`${day}_open`}
                        defaultChecked={isOpen}
                        className="h-4 w-4 rounded border-border-strong"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="time"
                        name={`${day}_start`}
                        defaultValue={window?.start ?? "09:00"}
                        className="h-9 w-32"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="time"
                        name={`${day}_end`}
                        defaultValue={window?.end ?? "19:00"}
                        className="h-9 w-32"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex justify-end">
        <SaveButton />
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
