import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays } from "date-fns";
import { format, toZonedTime } from "date-fns-tz";
import { RescheduleFlow } from "@/components/public/reschedule-flow";
import type { DayAvailability } from "@/components/public/booking-flow";
import { computeAvailableSlots } from "@/lib/slots/computeAvailableSlots";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { verifyManageToken } from "@/lib/tokens";
import { formatDateTimeInTz, formatLocalDateString } from "@/lib/tz";
import type { Booking, Car, Settings } from "@/lib/supabase/types";

const DAYS_AHEAD = 14;
const TYPE_LABEL = { viewing: "Viewing", test_drive: "Test drive" } as const;

export const metadata = { title: "Reschedule booking", robots: { index: false } };

export default async function ReschedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ id }, { token }] = await Promise.all([params, searchParams]);
  if (!token) notFound();

  const service = createSupabaseServiceClient();
  const { data: bookingData } = await service
    .from("bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!bookingData) notFound();
  const booking = bookingData as Booking;
  if (!verifyManageToken(token, booking.manage_token_hash)) notFound();
  if (booking.status !== "confirmed") {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Can&rsquo;t reschedule</h1>
        <p className="mt-2 text-sm text-fg-muted">
          This booking is {booking.status}. Book again from the cars page.
        </p>
        <Link href="/cars" className="mt-4 inline-block underline">
          Browse cars
        </Link>
      </div>
    );
  }

  const [{ data: carData }, { data: settingsData }] = await Promise.all([
    service.from("cars").select("*").eq("id", booking.car_id).single(),
    service
      .from("settings")
      .select("*")
      .eq("organization_id", booking.organization_id)
      .single(),
  ]);
  const car = carData as Car;
  const settings = settingsData as Settings;

  const tz = settings.timezone;
  const todayLocal = toZonedTime(new Date(), tz);
  const localDateStrings = Array.from({ length: DAYS_AHEAD }, (_, i) =>
    formatLocalDateString(addDays(todayLocal, i)),
  );
  const windowEnd = addDays(todayLocal, DAYS_AHEAD + 1);

  const [{ data: bookings }, { data: blocked }] = await Promise.all([
    service
      .from("bookings")
      .select("start_at, end_at")
      .eq("car_id", car.id)
      .eq("status", "confirmed")
      .neq("id", booking.id)
      .gte("start_at", todayLocal.toISOString())
      .lte("start_at", windowEnd.toISOString()),
    service
      .from("blocked_slots")
      .select("start_at, end_at")
      .eq("organization_id", booking.organization_id)
      .gte("end_at", todayLocal.toISOString())
      .lte("start_at", windowEnd.toISOString()),
  ]);

  const days: DayAvailability[] = localDateStrings.map((dateStr) => {
    const slots = computeAvailableSlots({
      localDate: dateStr,
      settings,
      bookings: bookings ?? [],
      blockedSlots: blocked ?? [],
    });
    const localDay = toZonedTime(new Date(`${dateStr}T12:00:00Z`), tz);
    return {
      date: dateStr,
      weekdayLabel: format(localDay, "EEE", { timeZone: tz }),
      dayNum: format(localDay, "d", { timeZone: tz }),
      monthLabel: format(localDay, "MMM", { timeZone: tz }),
      slots: slots.map((s) => ({
        startUtc: s.startUtc,
        timeLabel: format(toZonedTime(new Date(s.startUtc), tz), "HH:mm", { timeZone: tz }),
      })),
    };
  });

  const carHeadline = `${car.year} ${car.make} ${car.model}${car.variant ? ` ${car.variant}` : ""}`;

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <Link
        href={`/booking/${booking.id}?token=${token}`}
        className="text-sm font-medium text-fg-muted transition-colors hover:text-fg"
      >
        ← Back
      </Link>
      <div className="mt-6">
        <RescheduleFlow
          bookingId={booking.id}
          token={token}
          carHeadline={carHeadline}
          typeLabel={TYPE_LABEL[booking.type]}
          oldWhenLabel={formatDateTimeInTz(new Date(booking.start_at), tz)}
          days={days}
        />
      </div>
    </div>
  );
}
