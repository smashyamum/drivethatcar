import Link from "next/link";
import { notFound } from "next/navigation";
import { CarGallery } from "@/components/public/car-gallery";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { carPhotoPublicUrl } from "@/lib/supabase/storage";
import type { Car, CarPhoto } from "@/lib/supabase/types";
import { formatMileage, formatPrice } from "@/lib/utils";

const TRANSMISSION_LABEL: Record<string, string> = {
  manual: "Manual",
  automatic: "Automatic",
  semi_auto: "Semi-automatic",
};
const FUEL_LABEL: Record<string, string> = {
  petrol: "Petrol",
  diesel: "Diesel",
  hybrid: "Hybrid",
  phev: "Plug-in hybrid",
  electric: "Electric",
};
const BODY_LABEL: Record<string, string> = {
  hatchback: "Hatchback",
  saloon: "Saloon",
  estate: "Estate",
  suv: "SUV",
  coupe: "Coupe",
  convertible: "Convertible",
  mpv: "MPV",
  pickup: "Pickup",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("cars")
    .select("year, make, model, variant, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!data || data.status !== "available") return { title: "Car not available" };
  return {
    title: `${data.year} ${data.make} ${data.model}${data.variant ? ` ${data.variant}` : ""}`,
  };
}

export default async function PublicCarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: carRow } = await supabase
    .from("cars")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!carRow) notFound();
  const car = carRow as Car;

  if (car.status !== "available") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">No longer available</h1>
        <p className="mt-3 text-fg-muted">
          {car.status === "sold"
            ? "This car has been sold."
            : "This listing isn't available right now."}
        </p>
        <Link href="/cars" className="mt-6 inline-block">
          <Button variant="secondary">Browse other cars</Button>
        </Link>
      </div>
    );
  }

  const { data: photoRows } = await supabase
    .from("car_photos")
    .select("*")
    .eq("car_id", car.id)
    .order("position", { ascending: true });

  const photos = ((photoRows ?? []) as CarPhoto[]).map((p) => ({
    id: p.id,
    url: carPhotoPublicUrl(p.storage_path),
    alt: p.alt ?? `${car.year} ${car.make} ${car.model}`,
  }));

  const specs: Array<[string, string]> = [
    ["Year", car.year.toString()],
    ["Mileage", formatMileage(car.mileage)],
    ["Colour", car.colour ?? "—"],
    ["Transmission", car.transmission ? TRANSMISSION_LABEL[car.transmission] : "—"],
    ["Fuel", car.fuel_type ? FUEL_LABEL[car.fuel_type] : "—"],
    ["Body", car.body_type ? BODY_LABEL[car.body_type] : "—"],
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/cars"
        className="text-sm font-medium text-fg-muted transition-colors hover:text-fg"
      >
        ← All cars
      </Link>
      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-8">
          <CarGallery photos={photos} />
          <header>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {car.year} {car.make} {car.model}
              {car.variant ? <span className="font-normal text-fg-muted"> · {car.variant}</span> : null}
            </h1>
            <p className="mt-3 text-3xl font-semibold tracking-tight">
              {formatPrice(car.price_pence)}
            </p>
          </header>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-[12px] border border-border bg-bg-subtle p-6 sm:grid-cols-3">
            {specs.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-medium uppercase tracking-wide text-fg-muted">
                  {k}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-fg">{v}</dd>
              </div>
            ))}
          </dl>
          {car.description && (
            <section>
              <h2 className="text-xl font-semibold tracking-tight">About this car</h2>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-fg-body">
                {car.description}
              </p>
            </section>
          )}
        </div>
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-[12px] border border-border bg-bg p-6 shadow-sm">
            <h2 className="text-base font-semibold tracking-tight">Book a slot</h2>
            <p className="mt-1 text-sm text-fg-muted">
              Choose a 1-hour slot — we&rsquo;ll confirm by email.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link href={`/car/${car.slug}/book?type=viewing`}>
                <Button className="w-full">Book viewing</Button>
              </Link>
              <Link href={`/car/${car.slug}/book?type=test_drive`}>
                <Button variant="secondary" className="w-full">
                  Book test drive
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-fg-subtle">
              1-hour slot. No payment required. Cancel anytime.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
