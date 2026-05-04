import { fromZonedTime, toZonedTime, format } from "date-fns-tz";
import { addDays, parse, startOfDay } from "date-fns";
import type { Weekday } from "@/lib/supabase/types";

const WEEKDAY_KEYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Returns the weekday key (mon/tue/...) for a UTC instant in the given TZ. */
export function weekdayKeyInTz(date: Date, timezone: string): Weekday {
  const zoned = toZonedTime(date, timezone);
  return WEEKDAY_KEYS[zoned.getDay()];
}

/** Convert "HH:mm" on a given local date in tz to a UTC Date. */
export function localTimeToUtc(localDate: Date, hhmm: string, timezone: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const zonedDayStart = toZonedTime(startOfDay(localDate), timezone);
  zonedDayStart.setHours(h, m, 0, 0);
  return fromZonedTime(zonedDayStart, timezone);
}

/** Parse "yyyy-MM-dd" as a local date (no TZ math; used to interpret URL params). */
export function parseLocalDateString(s: string): Date {
  return parse(s, "yyyy-MM-dd", new Date());
}

export function formatLocalDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatTimeInTz(date: Date, timezone: string, fmt = "HH:mm"): string {
  return format(toZonedTime(date, timezone), fmt, { timeZone: timezone });
}

export function formatDateTimeInTz(date: Date, timezone: string): string {
  return format(toZonedTime(date, timezone), "EEE d MMM yyyy 'at' HH:mm", {
    timeZone: timezone,
  });
}

export function formatDateInTz(date: Date, timezone: string): string {
  return format(toZonedTime(date, timezone), "EEE d MMM yyyy", { timeZone: timezone });
}

/** Returns N consecutive local-date strings starting at startDate (in tz). */
export function nextLocalDateStrings(startDate: Date, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(formatLocalDateString(addDays(startDate, i)));
  }
  return out;
}
