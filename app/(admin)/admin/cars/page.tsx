import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CarBulkList } from "@/components/admin/car-bulk-list";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/tenant";
import type { Car } from "@/lib/supabase/types";

export const metadata = { title: "Cars · Admin" };

export default async function AdminCarsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    deleted?: string;
    archived?: string;
    bookings?: string;
    error?: string;
  }>;
}) {
  const {
    q,
    deleted,
    archived,
    bookings,
    error: errorParam,
  } = await searchParams;
  const deletedN = deleted ? Number(deleted) : 0;
  const archivedN = archived ? Number(archived) : 0;
  const bookingsN = bookings ? Number(bookings) : 0;
  const searchTerm = (q ?? "").trim();

  const supabase = await createSupabaseServerClient();
  const orgId = await getActiveOrgId();

  let query = supabase
    .from("cars")
    .select("*")
    .eq("organization_id", orgId);

  if (searchTerm) {
    const escaped = searchTerm.replace(/[%,]/g, "");
    // Match against the human-readable bits — make/model/variant/colour/reg
    // and the URL slug (handy for "where's the car with /seat-leon-…").
    query = query.or(
      `make.ilike.%${escaped}%,model.ilike.%${escaped}%,variant.ilike.%${escaped}%,colour.ilike.%${escaped}%,registration.ilike.%${escaped}%,slug.ilike.%${escaped}%`,
    );
  }

  const { data: carRows, error } = await query.order("created_at", {
    ascending: false,
  });
  const cars = (carRows ?? []) as Car[];

  // Booking counts per car — used in the bulk-delete confirm dialog and in
  // the per-row checkbox tooltip.
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
          <p className="mt-1 text-sm text-fg-muted">
            {cars.length} {cars.length === 1 ? "car" : "cars"}
            {searchTerm ? ` matching "${searchTerm}"` : " in stock"}.
          </p>
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

      {deletedN > 0 && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {deletedN} car{deletedN === 1 ? "" : "s"} deleted
          {bookingsN > 0
            ? ` (and ${bookingsN} booking${bookingsN === 1 ? "" : "s"})`
            : ""}
          .
        </p>
      )}

      {archivedN > 0 && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {archivedN} car{archivedN === 1 ? "" : "s"} archived. Existing bookings
          stay intact.
        </p>
      )}

      {errorParam && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorParam === "none_selected"
            ? "Select at least one car first."
            : `Action failed: ${errorParam}`}
        </p>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load cars: {error.message}
        </p>
      )}

      <form action="/admin/cars" method="get" className="flex flex-wrap gap-2">
        <Input
          name="q"
          defaultValue={searchTerm}
          placeholder="Search make, model, colour, registration…"
          className="max-w-sm"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {searchTerm && (
          <Link
            href="/admin/cars"
            className="self-center text-sm text-fg-muted hover:text-fg"
          >
            Clear
          </Link>
        )}
      </form>

      <CarBulkList
        cars={carsWithCounts}
        publicBaseUrl={
          process.env.NEXT_PUBLIC_SITE_URL ?? "https://drivethatcar.app"
        }
        q={searchTerm}
        emptyState={searchTerm ? "no-matches" : "no-cars"}
      />
    </div>
  );
}
