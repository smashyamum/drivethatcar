"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  rescheduleBooking,
  type RescheduleState,
} from "@/app/(public)/booking/[id]/reschedule/actions";
import type { DayAvailability } from "./booking-flow";

type Props = {
  bookingId: string;
  token: string;
  carHeadline: string;
  typeLabel: string;
  oldWhenLabel: string;
  days: DayAvailability[];
};

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Updating…" : "Confirm new time"}
    </Button>
  );
}

export function RescheduleFlow({
  bookingId,
  token,
  carHeadline,
  typeLabel,
  oldWhenLabel,
  days,
}: Props) {
  const firstAvailable = days.find((d) => d.slots.length > 0)?.date ?? days[0]?.date ?? "";
  const [selectedDate, setSelectedDate] = useState(firstAvailable);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [state, formAction] = useActionState<RescheduleState, FormData>(
    rescheduleBooking,
    {},
  );

  const day = days.find((d) => d.date === selectedDate);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm font-medium text-fg-muted">{typeLabel} · reschedule</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {carHeadline}
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Currently booked for <span className="line-through">{oldWhenLabel}</span>. Pick a new
          time below.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-fg">New day</h2>
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
        <h2 className="text-sm font-semibold text-fg">New time</h2>
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
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={bookingId} />
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="startUtc" value={selectedSlot} />
          {state.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}
          <ConfirmButton />
        </form>
      )}
    </div>
  );
}
