import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Car, CarStatus } from "@/lib/supabase/types";
import { formatMileage, formatPrice } from "@/lib/utils";

export const metadata = { title: "Cars · Admin" };

const STATUS_TONE: Record<CarStatus, "success" | "warning" | "neutral"> = {
  available: "success",
  sold: "warning",
  hidden: "neutral",
};

export default async function AdminCarsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; bookings?: string }>;
}) {
  const { deleted, bookings } = await searchParams;
  const bookingsN = bookings ? Number(bookings) : 0;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .order("created_at", { ascending: false });

  const cars = (data ?? []) as Car[];

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
          Car deleted{bookingsN > 0 ? ` (and ${bookingsN} booking${bookingsN === 1 ? "" : "s"})` : ""}.
        </p>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load cars: {error.message}
        </p>
      )}

      {cars.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong bg-bg p-10 text-center">
          <p className="text-sm text-fg-muted">No cars yet.</p>
          <Link href="/admin/cars/new" className="mt-3 inline-block">
            <Button>Add your first car</Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-bg">
          <table className="w-full text-sm">
            <thead className="bg-bg-subtle text-left text-xs uppercase tracking-wide text-fg-muted">
              <tr>
                <th className="px-4 py-3">Car</th>
                <th className="px-4 py-3">Mileage</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cars.map((car) => (
                <tr key={car.id} className="hover:bg-bg-subtle">
                  <td className="px-4 py-3">
                    <Link href={`/admin/cars/${car.id}`} className="font-medium hover:underline">
                      {car.year} {car.make} {car.model}
                      {car.variant ? ` ${car.variant}` : ""}
                    </Link>
                    <div className="text-xs text-fg-muted">
                      {[car.colour, car.transmission, car.fuel_type].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-fg-muted">{formatMileage(car.mileage)}</td>
                  <td className="px-4 py-3 font-medium">{formatPrice(car.price_pence)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[car.status]}>{car.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/car/${car.slug}`}
                      target="_blank"
                      className="text-xs text-fg-muted hover:text-fg"
                    >
                      /car/{car.slug} ↗
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
