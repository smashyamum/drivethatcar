import Link from "next/link";
import { ImportCarsForm } from "@/components/admin/import-cars-form";

export const metadata = { title: "Import cars · Admin" };

export default function ImportCarsPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link href="/admin/cars" className="text-sm text-fg-muted hover:text-fg">
          ← Back to cars
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Import cars from CSV</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Upload a spreadsheet to add several cars at once. Each row becomes a new
          car in your stock; rows that fail validation are skipped and reported.
        </p>
      </div>

      <div className="rounded-[12px] border border-border bg-bg p-6">
        <h2 className="text-base font-semibold">CSV format</h2>
        <p className="mt-1 text-sm text-fg-muted">
          The first row must be a header. Required columns:{" "}
          <code className="font-mono text-[12px]">make</code>,{" "}
          <code className="font-mono text-[12px]">model</code>,{" "}
          <code className="font-mono text-[12px]">year</code>,{" "}
          <code className="font-mono text-[12px]">price</code> (in AED).
        </p>
        <p className="mt-2 text-sm text-fg-muted">
          Optional: <code className="font-mono text-[12px]">variant</code>,{" "}
          <code className="font-mono text-[12px]">mileage</code> (km),{" "}
          <code className="font-mono text-[12px]">colour</code>,{" "}
          <code className="font-mono text-[12px]">transmission</code> (manual /
          automatic / semi_auto),{" "}
          <code className="font-mono text-[12px]">fuel_type</code> (petrol / diesel
          / hybrid / phev / electric),{" "}
          <code className="font-mono text-[12px]">body_type</code> (hatchback /
          saloon / estate / suv / coupe / convertible / mpv / pickup),{" "}
          <code className="font-mono text-[12px]">registration</code>,{" "}
          <code className="font-mono text-[12px]">description</code>,{" "}
          <code className="font-mono text-[12px]">status</code> (available / sold /
          hidden — defaults to available).
        </p>
        <p className="mt-3 text-sm">
          <a
            href="/admin/cars/import/template"
            className="font-medium text-fg hover:underline"
          >
            Download template ↓
          </a>
        </p>
      </div>

      <div className="rounded-[12px] border border-border bg-bg p-6">
        <ImportCarsForm />
      </div>

      <p className="text-xs text-fg-muted">
        Photos can&rsquo;t be imported via CSV — add those per-car after import.
        Slugs are generated automatically.
      </p>
    </div>
  );
}
