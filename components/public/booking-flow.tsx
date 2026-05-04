"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createBooking, type BookingState } from "@/app/(public)/car/[slug]/book/actions";

export type DayAvailability = {
  /** "yyyy-MM-dd" in dealer timezone */
  date: string;
  /** Display labels precomputed server-side in dealer TZ */
  weekdayLabel: string; // "Mon"
  dayNum: string; // "5"
  monthLabel: string; // "May"
  /** Available slot start instants (UTC ISO) */
  slots: { startUtc: string; timeLabel: string }[];
};

type Props = {
  carId: string;
  carHeadline: string;
  type: "viewing" | "test_drive";
  days: DayAvailability[];
};

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Confirming…" : "Confirm booking"}
    </Button>
  );
}

export function BookingFlow({ carId, carHeadline, type, days }: Props) {
  const firstAvailable = days.find((d) => d.slots.length > 0)?.date ?? days[0]?.date ?? "";
  const [selectedDate, setSelectedDate] = useState(firstAvailable);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [state, formAction] = useActionState<BookingState, FormData>(createBooking, {});
  const fe = state.fieldErrors ?? {};

  const day = days.find((d) => d.date === selectedDate);
  const typeLabel = type === "viewing" ? "Viewing" : "Test drive";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm font-medium text-fg-muted">{typeLabel} · 1 hour</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {carHeadline}
        </h1>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-fg">Pick a day</h2>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {days.map((d) => {
            const hasSlots = d.slots.length > 0;
            const active = selectedDate === d.date;
            return (
              <button
                key={d.date}
                type="button"
                disabled={!hasSlots}
                onClick={() => {
                  setSelectedDate(d.date);
                  setSelectedSlot(null);
                }}
                className={cn(
                  "flex min-w-20 flex-col items-center rounded-[12px] border px-3 py-3 text-center transition-colors",
                  active
                    ? "border-fg bg-fg text-on-primary"
                    : hasSlots
                      ? "border-border bg-bg hover:border-border-strong"
                      : "border-border bg-bg-subtle text-fg-subtle line-through",
                )}
              >
                <span className="text-[11px] font-medium uppercase tracking-wide">
                  {d.weekdayLabel}
                </span>
                <span className="mt-0.5 text-xl font-semibold">{d.dayNum}</span>
                <span className="text-[11px] font-medium uppercase tracking-wide">
                  {d.monthLabel}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-fg">Pick a time</h2>
        {!day || day.slots.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-border-strong bg-bg-subtle p-6 text-center text-sm text-fg-muted">
            No slots available on this day. Try another.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {day.slots.map((s) => {
              const active = selectedSlot === s.startUtc;
              return (
                <button
                  key={s.startUtc}
                  type="button"
                  onClick={() => setSelectedSlot(s.startUtc)}
                  className={cn(
                    "rounded-md border px-3 py-2.5 text-sm font-semibold transition-colors",
                    active
                      ? "border-fg bg-fg text-on-primary"
                      : "border-border bg-bg hover:border-border-strong",
                  )}
                >
                  {s.timeLabel}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedSlot && (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-fg">Your details</h2>
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="carId" value={carId} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="startUtc" value={selectedSlot} />

            {state.error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {state.error}
              </p>
            )}

            <Field label="Full name" htmlFor="name" error={fe.name}>
              <Input id="name" name="name" autoComplete="name" required />
            </Field>
            <Field label="Phone" htmlFor="phone" error={fe.phone} hint="Include country code, e.g. +971…">
              <Input id="phone" name="phone" type="tel" autoComplete="tel" required />
            </Field>
            <Field label="Email" htmlFor="email" error={fe.email}>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </Field>
            <ConfirmButton />
            <p className="text-center text-xs text-fg-subtle">
              We&rsquo;ll send a confirmation email shortly.
            </p>
          </form>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-fg-muted">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
