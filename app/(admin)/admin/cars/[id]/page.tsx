import Link from "next/link";
import { notFound } from "next/navigation";
import { CarForm } from "@/components/admin/car-form";
import { PhotoManager } from "@/components/admin/photo-manager";
import { Button } from "@/components/ui/button";
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

  const updateAction = updateCar.bind(null, car.id);
  const deleteAction = deleteCar.bind(null, car.id);

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
          Permanently delete this car. Bookings against it will block the delete in M3+.
        </p>
        <form action={deleteAction} className="mt-4">
          <Button type="submit" variant="danger" size="sm">
            Delete car
          </Button>
        </form>
      </div>
    </div>
  );
}
