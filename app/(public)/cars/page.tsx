import Image from "next/image";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { carPhotoPublicUrl } from "@/lib/supabase/storage";
import type { Car, CarPhoto } from "@/lib/supabase/types";
import { formatMileage, formatPrice } from "@/lib/utils";

export const metadata = { title: "Cars · Car Booking" };

type CarWithCover = Car & { cover?: CarPhoto | null };

export default async function PublicCarsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: carsData } = await supabase
    .from("cars")
    .select("*")
    .eq("status", "available")
    .order("created_at", { ascending: false });

  const cars = (carsData ?? []) as Car[];
  const carIds = cars.map((c) => c.id);

  const photosByCar = new Map<string, CarPhoto>();
  if (carIds.length > 0) {
    const { data: photoData } = await supabase
      .from("car_photos")
      .select("*")
      .in("car_id", carIds)
      .order("position", { ascending: true });

    for (const photo of (photoData ?? []) as CarPhoto[]) {
      const existing = photosByCar.get(photo.car_id);
      if (!existing || photo.is_primary || photo.position < existing.position) {
        if (!existing || photo.is_primary) photosByCar.set(photo.car_id, photo);
      }
    }
  }

  const carsWithCover: CarWithCover[] = cars.map((c) => ({
    ...c,
    cover: photosByCar.get(c.id) ?? null,
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10">
        <Link
          href="/"
          className="text-sm font-medium text-fg-muted transition-colors hover:text-fg"
        >
          ← Home
        </Link>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Available cars</h1>
        <p className="mt-2 text-fg-muted">
          {cars.length} {cars.length === 1 ? "car" : "cars"} in stock.
        </p>
      </header>

      {cars.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-border-strong bg-bg-subtle p-16 text-center">
          <p className="text-fg-muted">No cars listed right now. Check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {carsWithCover.map((car) => (
            <Link
              key={car.id}
              href={`/car/${car.slug}`}
              className="group flex flex-col overflow-hidden rounded-[12px] border border-border bg-bg transition-all hover:border-border-strong hover:shadow-sm"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-bg-muted">
                {car.cover ? (
                  <Image
                    src={carPhotoPublicUrl(car.cover.storage_path)}
                    alt={`${car.year} ${car.make} ${car.model}`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs uppercase tracking-wide text-fg-subtle">
                    No photo yet
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="text-base font-semibold tracking-tight text-fg">
                  {car.year} {car.make} {car.model}
                  {car.variant ? ` ${car.variant}` : ""}
                </h2>
                <p className="mt-1 text-sm text-fg-muted">
                  {[car.colour, car.transmission, car.fuel_type].filter(Boolean).join(" · ") ||
                    "—"}
                </p>
                <div className="mt-auto flex items-end justify-between pt-4">
                  <span className="text-lg font-semibold tracking-tight">
                    {formatPrice(car.price_pence)}
                  </span>
                  <span className="text-xs text-fg-muted">
                    {formatMileage(car.mileage)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
