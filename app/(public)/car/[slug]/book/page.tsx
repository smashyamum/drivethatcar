import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays } from "date-fns";
import { format, toZonedTime } from "date-fns-tz";
import { BookingFlow, type DayAvailability } from "@/components/public/booking-flow";
import { computeAvailableSlots } from "@/lib/slots/computeAvailableSlots";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { formatLocalDateString } from "@/lib/tz";
import type { Car, Settings } from "@/lib/supabase/types";

const DAYS_AHEAD = 14;

export const metadata = { title: "Book · Car Booking" };

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const type = search.type === "test_drive" ? "test_drive" : "viewing";

  const service = createSupabaseServiceClient();
  const { data: carData } = await service
    .from("cars")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!carData) notFound();
  const car = carData as Car;

  const { data: settingsData } = await service
    .from("settings")
    .select("*")
    .eq("organization_id", car.organization_id)
    .maybeSingle();
  if (!settingsData) notFound();
  const settings = settingsData as Settings;

  if (car.status !== "available") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">No longer available</h1>
        <p className="mt-3 text-fg-muted">This car can&rsquo;t be booked right now.</p>
        <Link href="/cars" className="mt-6 inline-block underline">
          Browse other cars
        </Link>
      </div>
    );
  }

  // Build the date window
  const tz = settings.timezone;
  const todayLocal = toZonedTime(new Date(), tz);
  const localDateStrings = Array.from({ length: DAYS_AHEAD }, (_, i) =>
    formatLocalDateString(addDays(todayLocal, i)),
  );

  // Fetch all bookings + blocked slots in the window once (small)
  const windowEnd = addDays(todayLocal, DAYS_AHEAD + 1);
  const [{ data: bookingsData }, { data: blockedData }] = await Promise.all([
    service
      .from("bookings")
      .select("start_at, end_at, car_id, status")
      .eq("car_id", car.id)
      .eq("status", "confirmed")
      .gte("start_at", todayLocal.toISOString())
      .lte("start_at", windowEnd.toISOString()),
    service
      .from("blocked_slots")
      .select("start_at, end_at")
      .eq("organization_id", car.organization_id)
      .gte("end_at", todayLocal.toISOString())
      .lte("start_at", windowEnd.toISOString()),
  ]);

  const days: DayAvailability[] = localDateStrings.map((dateStr) => {
    const slots = computeAvailableSlots({
      localDate: dateStr,
      settings,
      bookings: bookingsData ?? [],
      blockedSlots: blockedData ?? [],
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
        href={`/car/${car.slug}`}
        className="text-sm font-medium text-fg-muted transition-colors hover:text-fg"
      >
        ← Back to car
      </Link>
      <div className="mt-6">
        <BookingFlow carId={car.id} carHeadline={carHeadline} type={type} days={days} />
      </div>
    </div>
  );
}
