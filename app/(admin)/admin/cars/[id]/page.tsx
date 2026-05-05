import Link from "next/link";
import { notFound } from "next/navigation";
import { CarForm } from "@/components/admin/car-form";
import { DeleteCarForm } from "@/components/admin/delete-car-form";
import { PhotoManager } from "@/components/admin/photo-manager";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Car, CarPhoto } from "@/lib/supabase/types";
import { deleteCar, updateCar } from "../actions";

export const metadata = { title: "Edit car · Admin" };

export default async function EditCarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data: carRow, error }, { data: photoRows }] = await Promise.all([
    supabase.from("cars").select("*").eq("id", id).single(),
    supabase
      .from("car_photos")
      .select("*")
      .eq("car_id", id)
      .order("position", { ascending: true }),
  ]);

  if (error || !carRow) notFound();
  const car = carRow as Car;
  const photos = (photoRows ?? []) as CarPhoto[];

  const { count: bookingCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("car_id", car.id);

  const updateAction = updateCar.bind(null, car.id);
  const deleteAction = deleteCar.bind(null, car.id);
  const carHeadline = `${car.year} ${car.make} ${car.model}${car.variant ? ` ${car.variant}` : ""}`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {car.year} {car.make} {car.model}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Public link:{" "}
            <Link href={`/car/${car.slug}`} target="_blank" className="hover:underline">
              /car/{car.slug} ↗
            </Link>
          </p>
        </div>
        <Link href="/admin/cars" className="text-sm text-fg-muted hover:text-fg">
          ← Back
        </Link>
      </div>

      <div className="rounded-[12px] border border-border bg-bg p-6">
        <PhotoManager carId={car.id} photos={photos} />
      </div>

      <div className="rounded-[12px] border border-border bg-bg p-6">
        <CarForm
          action={updateAction}
          initial={car}
          submitLabel="Save changes"
          cancelHref="/admin/cars"
          showSlug
        />
      </div>

      <div className="rounded-[12px] border border-red-200 bg-red-50/40 p-6">
        <h2 className="text-base font-semibold text-red-900">Danger zone</h2>
        <p className="mt-1 text-sm text-red-800/80">
          Permanently remove this car from stock.{" "}
          {(bookingCount ?? 0) > 0 ? (
            <>
              This car has <strong>{bookingCount}</strong> booking
              {bookingCount === 1 ? "" : "s"} — delete won&rsquo;t work until
              they&rsquo;re cleared. For sold cars, set status to{" "}
              <strong>sold</strong>; to take a car off the public site without
              deleting, set it to <strong>hidden</strong>.
            </>
          ) : (
            <>
              No bookings exist for this car, so it&rsquo;s safe to delete. To
              keep history, set status to <strong>sold</strong> or{" "}
              <strong>hidden</strong> instead.
            </>
          )}
        </p>
        <div className="mt-4">
          <DeleteCarForm
            action={deleteAction}
            carHeadline={carHeadline}
            bookingCount={bookingCount ?? 0}
          />
        </div>
      </div>
    </div>
  );
}
