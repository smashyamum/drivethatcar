"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Car } from "@/lib/supabase/types";
import type { CarFormState } from "@/app/(admin)/admin/cars/actions";

type Props = {
  action: (prev: CarFormState, formData: FormData) => Promise<CarFormState>;
  initial?: Car | null;
  submitLabel: string;
  cancelHref: string;
  showSlug?: boolean;
};

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-fg-muted">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function CarForm({ action, initial, submitLabel, cancelHref, showSlug = false }: Props) {
  const [state, formAction] = useActionState<CarFormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  const initialPricePounds = initial ? (initial.price_pence / 100).toString() : "";

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Make" htmlFor="make" error={fe.make}>
          <Input id="make" name="make" defaultValue={initial?.make ?? ""} required />
        </Field>
        <Field label="Model" htmlFor="model" error={fe.model}>
          <Input id="model" name="model" defaultValue={initial?.model ?? ""} required />
        </Field>
        <Field label="Year" htmlFor="year" error={fe.year}>
          <Input
            id="year"
            name="year"
            type="number"
            inputMode="numeric"
            min={1900}
            max={2100}
            defaultValue={initial?.year ?? new Date().getFullYear()}
            required
          />
        </Field>
        <Field label="Variant / trim" htmlFor="variant" error={fe.variant}>
          <Input id="variant" name="variant" defaultValue={initial?.variant ?? ""} placeholder="e.g. M Sport" />
        </Field>
        <Field label="Colour" htmlFor="colour" error={fe.colour}>
          <Input id="colour" name="colour" defaultValue={initial?.colour ?? ""} />
        </Field>
        <Field label="Mileage (km)" htmlFor="mileage" error={fe.mileage}>
          <Input
            id="mileage"
            name="mileage"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={initial?.mileage ?? ""}
          />
        </Field>
        <Field label="Price (AED)" htmlFor="price_pounds" error={fe.price_pounds}>
          <Input
            id="price_pounds"
            name="price_pounds"
            type="number"
            inputMode="decimal"
            min={0}
            step="1"
            defaultValue={initialPricePounds}
            required
          />
        </Field>
        <Field label="Transmission" htmlFor="transmission" error={fe.transmission}>
          <Select id="transmission" name="transmission" defaultValue={initial?.transmission ?? ""}>
            <option value="">—</option>
            <option value="manual">Manual</option>
            <option value="automatic">Automatic</option>
            <option value="semi_auto">Semi-automatic</option>
          </Select>
        </Field>
        <Field label="Fuel" htmlFor="fuel_type" error={fe.fuel_type}>
          <Select id="fuel_type" name="fuel_type" defaultValue={initial?.fuel_type ?? ""}>
            <option value="">—</option>
            <option value="petrol">Petrol</option>
            <option value="diesel">Diesel</option>
            <option value="hybrid">Hybrid</option>
            <option value="phev">Plug-in hybrid</option>
            <option value="electric">Electric</option>
          </Select>
        </Field>
        <Field label="Body" htmlFor="body_type" error={fe.body_type}>
          <Select id="body_type" name="body_type" defaultValue={initial?.body_type ?? ""}>
            <option value="">—</option>
            <option value="hatchback">Hatchback</option>
            <option value="saloon">Saloon</option>
            <option value="estate">Estate</option>
            <option value="suv">SUV</option>
            <option value="coupe">Coupe</option>
            <option value="convertible">Convertible</option>
            <option value="mpv">MPV</option>
            <option value="pickup">Pickup</option>
          </Select>
        </Field>
        <Field
          label="Registration (private)"
          htmlFor="registration"
          error={fe.registration}
          hint="Not shown publicly"
        >
          <Input id="registration" name="registration" defaultValue={initial?.registration ?? ""} />
        </Field>
        <Field label="Status" htmlFor="status" error={fe.status}>
          <Select id="status" name="status" defaultValue={initial?.status ?? "available"}>
            <option value="available">Available</option>
            <option value="sold">Sold (auto-hides booking page)</option>
            <option value="hidden">Archived (off public listings)</option>
          </Select>
        </Field>
      </div>

      <Field label="Description" htmlFor="description" error={fe.description}>
        <Textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={initial?.description ?? ""}
          placeholder="Condition notes, history, extras…"
        />
      </Field>

      {showSlug && (
        <Field
          label="URL slug"
          htmlFor="slug"
          error={fe.slug}
          hint={`Public URL: /car/<slug>. Leave blank to auto-generate.${
            initial ? ` Current: ${initial.slug}` : ""
          }`}
        >
          <Input id="slug" name="slug" defaultValue={initial?.slug ?? ""} placeholder="auto-generated if blank" />
        </Field>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link
          href={cancelHref}
          className="text-sm text-fg-muted hover:text-fg"
        >
          Cancel
        </Link>
        <SaveButton label={submitLabel} />
      </div>
    </form>
  );
}
