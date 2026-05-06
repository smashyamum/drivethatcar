import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/tenant";
import { formatDateTimeInTz } from "@/lib/tz";
import type {
  Booking,
  BookingStatus,
  Car,
  Customer,
  Settings,
} from "@/lib/supabase/types";
import { setBookingStatus } from "../actions";

export const metadata = { title: "Booking · Admin" };

const STATUS_TONE: Record<BookingStatus, "success" | "warning" | "danger" | "neutral"> = {
  confirmed: "success",
  completed: "neutral",
  cancelled: "danger",
  no_show: "warning",
};
const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No show",
};
const TYPE_LABEL = { viewing: "Viewing", test_drive: "Test drive" } as const;

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const orgId = await getActiveOrgId();

  const [{ data: bookingData }, { data: settingsData }] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, car:cars(*), customer:customers(*)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("settings").select("*").eq("organization_id", orgId).single(),
  ]);

  if (!bookingData) notFound();
  const booking = bookingData as unknown as Booking & {
    car: Car;
    customer: Customer;
  };
  const tz = (settingsData as Settings).timezone;

  const cancel = async () => {
    "use server";
    await setBookingStatus(booking.id, "cancelled");
  };
  const complete = async () => {
    "use server";
    await setBookingStatus(booking.id, "completed");
  };
  const noShow = async () => {
    "use server";
    await setBookingStatus(booking.id, "no_show");
  };
  const reinstate = async () => {
    "use server";
    await setBookingStatus(booking.id, "confirmed");
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/bookings" className="text-sm text-fg-muted hover:text-fg">
            ← All bookings
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {formatDateTimeInTz(new Date(booking.start_at), tz)}
          </h1>
          <p className="mt-1 font-mono text-xs text-fg-muted">{booking.reference}</p>
        </div>
        <Badge tone={STATUS_TONE[booking.status]}>{STATUS_LABEL[booking.status]}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card title="Customer">
          <Field label="Name" value={booking.customer.name} />
          <Field label="Phone" value={booking.customer.phone} />
          <Field label="Email" value={booking.customer.email} />
        </Card>
        <Card title="Booking">
          <Field label="Type" value={TYPE_LABEL[booking.type]} />
          <Field label="Slot" value={formatDateTimeInTz(new Date(booking.start_at), tz)} />
          <Field
            label="Car"
            value={`${booking.car.year} ${booking.car.make} ${booking.car.model}${
              booking.car.variant ? ` ${booking.car.variant}` : ""
            }`}
          />
        </Card>
      </div>

      <div className="rounded-[12px] border border-border bg-bg p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">Update</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {booking.status === "confirmed" && (
            <>
              <form action={complete}>
                <Button type="submit" size="sm">Mark completed</Button>
              </form>
              <form action={noShow}>
                <Button type="submit" size="sm" variant="secondary">Mark no-show</Button>
              </form>
              <form action={cancel}>
                <Button type="submit" size="sm" variant="danger">Cancel</Button>
              </form>
            </>
          )}
          {booking.status !== "confirmed" && (
            <form action={reinstate}>
              <Button type="submit" size="sm" variant="secondary">Reinstate as confirmed</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-border bg-bg p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">{title}</h2>
      <dl className="mt-4 flex flex-col gap-3 text-sm">{children}</dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-right font-medium text-fg">{value}</dd>
    </div>
  );
}
