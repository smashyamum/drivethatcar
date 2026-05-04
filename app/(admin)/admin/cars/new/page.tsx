import { CarForm } from "@/components/admin/car-form";
import { createCar } from "../actions";

export const metadata = { title: "New car · Admin" };

export default function NewCarPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Add a car</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Required: make, model, year, price. Slug is auto-generated.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-bg p-6">
        <CarForm
          action={createCar}
          submitLabel="Create car"
          cancelHref="/admin/cars"
        />
      </div>
    </div>
  );
}
