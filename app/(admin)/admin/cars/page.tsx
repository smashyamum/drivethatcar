import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CarBulkList } from "@/components/admin/car-bulk-list";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/tenant";
import type { Car } from "@/lib/supabase/types";

export const metadata = { title: "Cars · Admin" };

export default async function AdminCarsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; bookings?: string; error?: string }>;
}) {
  const { deleted, bookings, error: errorParam } = await searchParams;
  const deletedN = deleted ? Number(deleted) : 0;
  const bookingsN = bookings ? Number(bookings) : 0;

  const supabase = await createSupabaseServerClient();
  const orgId = await getActiveOrgId();

  const { data: carRows, error } = await supabase
    .from("cars")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  const cars = (carRows ?? []) as Car[];

  // Booking counts per car — used for the confirm dialog ("delete N cars
  // and their X bookings"). One query, then map.
  let bookingCountByCar = new Map<string, number>();
  if (cars.length > 0) {
    const { data: bookingRows } = await supabase
      .from("bookings")
      .select("car_id")
      .in(
        "car_id",
        cars.map((c) => c.id),
      );
    bookingCountByCar = (bookingRows ?? []).reduce((acc, row) => {
      const id = (row as { car_id: string }).car_id;
      acc.set(id, (acc.get(id) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());
  }
  const carsWithCounts = cars.map((c) => ({
    ...c,
    bookingCount: bookingCountByCar.get(c.id) ?? 0,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cars</h1>
          <p className="mt-1 text-sm text-fg-muted">{cars.length} in stock.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/cars/import">
            <Button variant="secondary">Import CSV</Button>
          </Link>
          <Link href="/admin/cars/new">
            <Button>Add car</Button>
          </Link>
        </div>
      </div>

      {deleted && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {deletedN} car{deletedN === 1 ? "" : "s"} deleted
          {bookingsN > 0
            ? ` (and ${bookingsN} booking${bookingsN === 1 ? "" : "s"})`
            : ""}
          .
        </p>
      )}

      {errorParam && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorParam === "none_selected"
            ? "Select at least one car to delete."
            : `Delete failed: ${errorParam}`}
        </p>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load cars: {error.message}
        </p>
      )}

      <CarBulkList cars={carsWithCounts} />
    </div>
  );
}
