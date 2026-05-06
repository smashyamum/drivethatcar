import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/tenant";
import { formatDateTimeInTz } from "@/lib/tz";
import type { Booking, BookingStatus, Car, Customer, Settings } from "@/lib/supabase/types";

export const metadata = { title: "Bookings · Admin" };

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

type BookingRow = Booking & {
  car: Pick<Car, "id" | "year" | "make" | "model" | "variant" | "slug"> | null;
  customer: Pick<Customer, "id" | "name" | "phone"> | null;
};

export default async function AdminBookingsPage() {
  const supabase = await createSupabaseServerClient();
  const orgId = await getActiveOrgId();
  const [{ data: bookingData }, { data: settingsData }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "*, car:cars(id, year, make, model, variant, slug), customer:customers(id, name, phone)",
      )
      .eq("organization_id", orgId)
      .order("start_at", { ascending: false }),
    supabase.from("settings").select("*").eq("organization_id", orgId).single(),
  ]);

  const bookings = (bookingData ?? []) as unknown as BookingRow[];
  const tz = (settingsData as Settings | null)?.timezone ?? "Asia/Dubai";

  const now = new Date();
  const upcoming = bookings.filter(
    (b) => new Date(b.start_at) >= now && b.status === "confirmed",
  );
  const past = bookings.filter(
    (b) => new Date(b.start_at) < now || b.status !== "confirmed",
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <p className="mt-1 text-sm text-fg-muted">
          {upcoming.length} upcoming · {past.length} past
        </p>
      </div>

      <Section title="Upcoming">
        <BookingTable bookings={upcoming} tz={tz} />
      </Section>

      <Section title="Past & cancelled">
        <BookingTable bookings={past} tz={tz} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">{title}</h2>
      {children}
    </section>
  );
}

function BookingTable({ bookings, tz }: { bookings: BookingRow[]; tz: string }) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-border-strong bg-bg-subtle p-8 text-center text-sm text-fg-muted">
        Nothing here yet.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-bg">
      <table className="w-full text-sm">
        <thead className="bg-bg-subtle text-left text-xs uppercase tracking-wide text-fg-muted">
          <tr>
            <th className="px-4 py-3">When</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Car</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {bookings.map((b) => (
            <tr key={b.id} className="hover:bg-bg-subtle">
              <td className="px-4 py-3">
                <Link href={`/admin/bookings/${b.id}`} className="font-medium hover:underline">
                  {formatDateTimeInTz(new Date(b.start_at), tz)}
                </Link>
                <div className="font-mono text-xs text-fg-muted">{b.reference}</div>
              </td>
              <td className="px-4 py-3">
                <div className="font-medium">{b.customer?.name ?? "—"}</div>
                <div className="text-xs text-fg-muted">{b.customer?.phone ?? "—"}</div>
              </td>
              <td className="px-4 py-3 text-fg-muted">
                {b.car
                  ? `${b.car.year} ${b.car.make} ${b.car.model}${b.car.variant ? ` ${b.car.variant}` : ""}`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-fg-muted">{TYPE_LABEL[b.type]}</td>
              <td className="px-4 py-3">
                <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
