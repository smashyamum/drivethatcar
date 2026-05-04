import { addMinutes } from "date-fns";
import {
  localTimeToUtc,
  parseLocalDateString,
  weekdayKeyInTz,
} from "@/lib/tz";
import type { BlockedSlot, Booking, Settings } from "@/lib/supabase/types";

export type AvailableSlot = {
  /** UTC start instant, ISO 8601 string. */
  startUtc: string;
  /** UTC end instant, ISO 8601 string. */
  endUtc: string;
};

type Inputs = {
  /** Local date string "yyyy-MM-dd" in `settings.timezone`. */
  localDate: string;
  settings: Pick<
    Settings,
    "timezone" | "slot_duration_minutes" | "buffer_minutes" | "working_hours"
  >;
  /** Confirmed bookings for this car overlapping the day. */
  bookings: Pick<Booking, "start_at" | "end_at">[];
  /** Admin-blocked windows overlapping the day. */
  blockedSlots: Pick<BlockedSlot, "start_at" | "end_at">[];
  /** Optional Google free/busy windows (M5+). */
  googleBusy?: Array<{ start_at: string; end_at: string }>;
  /** "Now" — defaults to current time; injectable for tests. */
  now?: Date;
};

type Interval = { start: Date; end: Date };

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function computeAvailableSlots({
  localDate,
  settings,
  bookings,
  blockedSlots,
  googleBusy = [],
  now = new Date(),
}: Inputs): AvailableSlot[] {
  const localDay = parseLocalDateString(localDate);
  const weekday = weekdayKeyInTz(localDay, settings.timezone);
  const windows = settings.working_hours[weekday] ?? [];
  if (windows.length === 0) return [];

  const duration = settings.slot_duration_minutes;
  const buffer = settings.buffer_minutes;

  // Build candidate slots from each working window
  const candidates: Interval[] = [];
  for (const window of windows) {
    const windowStart = localTimeToUtc(localDay, window.start, settings.timezone);
    const windowEnd = localTimeToUtc(localDay, window.end, settings.timezone);
    let cursor = windowStart;
    while (true) {
      const slotEnd = addMinutes(cursor, duration);
      if (slotEnd > windowEnd) break;
      candidates.push({ start: cursor, end: slotEnd });
      cursor = slotEnd;
    }
  }

  // Build busy intervals — bookings expanded by buffer on each side
  const busy: Interval[] = [];
  for (const b of bookings) {
    busy.push({
      start: addMinutes(new Date(b.start_at), -buffer),
      end: addMinutes(new Date(b.end_at), buffer),
    });
  }
  for (const bs of blockedSlots) {
    busy.push({ start: new Date(bs.start_at), end: new Date(bs.end_at) });
  }
  for (const g of googleBusy) {
    busy.push({ start: new Date(g.start_at), end: new Date(g.end_at) });
  }

  return candidates
    .filter((c) => c.start > now)
    .filter((c) => !busy.some((b) => overlaps(c, b)))
    .map((c) => ({ startUtc: c.start.toISOString(), endUtc: c.end.toISOString() }));
}
