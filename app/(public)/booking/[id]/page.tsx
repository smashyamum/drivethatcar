import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { formatDateTimeInTz } from "@/lib/tz";
import type { Booking, Car, Customer, Settings } from "@/lib/supabase/types";
import { verifyManageToken } from "@/lib/tokens";

export const metadata = {
  title: "Booking confirmed",
  robots: { index: false },
};

const TYPE_LABEL = { viewing: "Viewing", test_drive: "Test drive" } as const;
const STATUS_LABEL = {
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No show",
} as const;

export default async function BookingConfirmationPage({
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

  const [{ data: carData }, { data: customerData }, { data: settingsData }] = await Promise.all([
    service.from("cars").select("*").eq("id", booking.car_id).single(),
    service.from("customers").select("*").eq("id", booking.customer_id).single(),
    service.from("settings").select("*").eq("id", 1).single(),
  ]);

  const car = carData as Car;
  const customer = customerData as Customer;
  const settings = settingsData as Settings;
  const startDate = new Date(booking.start_at);

  const isCancelled = booking.status === "cancelled";

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <div className="rounded-[12px] border border-border bg-bg p-8 shadow-sm">
        <span
          className={
            isCancelled
              ? "inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700"
              : "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
          }
        >
          {isCancelled ? "Cancelled" : "Confirmed"}
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          {isCancelled ? "Booking cancelled" : "You're booked in"}
        </h1>
        <p className="mt-2 text-fg-muted">
          Booking reference{" "}
          <span className="font-mono text-fg">{booking.reference}</span>
        </p>

        <dl className="mt-6 flex flex-col gap-3 rounded-[12px] border border-border bg-bg-subtle p-5 text-sm">
          <Row label="When" value={formatDateTimeInTz(startDate, settings.timezone)} />
          <Row label="What" value={`${TYPE_LABEL[booking.type]} · ${settings.slot_duration_minutes} minutes`} />
          <Row
            label="Car"
            value={`${car.year} ${car.make} ${car.model}${car.variant ? ` ${car.variant}` : ""}`}
          />
          <Row label="Status" value={STATUS_LABEL[booking.status]} />
        </dl>

        <div className="mt-6 flex flex-col gap-3 text-sm text-fg-muted">
          <p>Hi {customer.name.split(" ")[0]}, save this page or check your email — you can use the link to reschedule or cancel anytime.</p>
          {settings.contact_phone && (
            <p>Need to reach us? {settings.contact_phone}</p>
          )}
        </div>

        {!isCancelled && (
          <div className="mt-8 flex flex-col gap-3">
            <Link href={`/booking/${booking.id}/reschedule?token=${token}`}>
              <Button className="w-full">Reschedule</Button>
            </Link>
            <Link href={`/booking/${booking.id}/cancel?token=${token}`}>
              <Button variant="ghost" className="w-full">
                Cancel booking
              </Button>
            </Link>
          </div>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-fg-subtle">
        Email reminders & calendar sync arrive in the next milestones.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-right font-medium text-fg">{value}</dd>
    </div>
  );
}
