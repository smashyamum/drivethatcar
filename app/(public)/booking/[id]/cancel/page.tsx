import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { verifyManageToken } from "@/lib/tokens";
import { formatDateTimeInTz } from "@/lib/tz";
import type { Booking, Car, Settings } from "@/lib/supabase/types";
import { cancelBookingByCustomer } from "./actions";

export const metadata = { title: "Cancel booking", robots: { index: false } };

export default async function CancelBookingPage({
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

  const startDate = new Date(booking.start_at);

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <div className="rounded-[12px] border border-border bg-bg p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Cancel this booking?</h1>
        <p className="mt-2 text-sm text-fg-muted">
          {booking.reference} · {car.year} {car.make} {car.model}
        </p>
        <p className="mt-1 text-sm text-fg-muted">
          {formatDateTimeInTz(startDate, settings.timezone)}
        </p>
        <p className="mt-6 text-sm text-fg-body">
          You can always book again later. The slot will become available to other customers.
        </p>
        <form action={cancelBookingByCustomer} className="mt-6 flex flex-col gap-3">
          <input type="hidden" name="id" value={booking.id} />
          <input type="hidden" name="token" value={token} />
          <Button type="submit" variant="danger" className="w-full">
            Yes, cancel booking
          </Button>
          <Link href={`/booking/${booking.id}?token=${token}`}>
            <Button type="button" variant="ghost" className="w-full">
              Keep my booking
            </Button>
          </Link>
        </form>
      </div>
    </div>
  );
}
