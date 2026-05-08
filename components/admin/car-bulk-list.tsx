"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyLinkButton } from "@/components/admin/copy-link-button";
import type { Car, CarStatus } from "@/lib/supabase/types";
import { formatMileage, formatPrice } from "@/lib/utils";
import { deleteCars } from "@/app/(admin)/admin/cars/actions";

const STATUS_TONE: Record<CarStatus, "success" | "warning" | "neutral"> = {
  available: "success",
  sold: "warning",
  hidden: "neutral",
};

type Row = Car & {
  bookingCount: number;
};

export function CarBulkList({
  cars,
  publicBaseUrl,
}: {
  cars: Row[];
  /** e.g. "https://drivethatcar.app" — used to build absolute copy-to-clipboard URLs. */
  publicBaseUrl: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allIds = useMemo(() => cars.map((c) => c.id), [cars]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  const selectedBookings = useMemo(
    () =>
      cars
        .filter((c) => selected.has(c.id))
        .reduce((sum, c) => sum + c.bookingCount, 0),
    [cars, selected],
  );

  function onDeleteClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (selected.size === 0) {
      e.preventDefault();
      return;
    }
    const carWord = selected.size === 1 ? "car" : "cars";
    const bookingPhrase =
      selectedBookings > 0
        ? ` and their ${selectedBookings} booking${selectedBookings === 1 ? "" : "s"}`
        : "";
    const msg = `Permanently delete ${selected.size} ${carWord}${bookingPhrase}? This can't be undone — future confirmed bookings will get cancellation emails.`;
    if (!window.confirm(msg)) e.preventDefault();
  }

  if (cars.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-strong bg-bg p-10 text-center">
        <p className="text-sm text-fg-muted">No cars yet.</p>
        <Link href="/admin/cars/new" className="mt-3 inline-block">
          <Button>Add your first car</Button>
        </Link>
      </div>
    );
  }

  return (
    <form ref={formRef} action={deleteCars} className="flex flex-col gap-3">
      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}

      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg-subtle px-3 py-2">
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-border-strong"
            disabled={allIds.length === 0}
          />
          {selected.size > 0 ? `${selected.size} selected` : `Select all`}
        </label>
        <Button
          type="submit"
          variant="danger"
          size="sm"
          disabled={selected.size === 0}
          onClick={onDeleteClick}
        >
          Delete selected
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-bg">
        <table className="w-full text-sm">
          <thead className="bg-bg-subtle text-left text-xs uppercase tracking-wide text-fg-muted">
            <tr>
              <th className="w-10 px-4 py-3"></th>
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
                  <input
                    type="checkbox"
                    checked={selected.has(car.id)}
                    onChange={() => toggle(car.id)}
                    title={
                      car.bookingCount > 0
                        ? `Has ${car.bookingCount} booking${car.bookingCount === 1 ? "" : "s"} — they'll be deleted too`
                        : "Select"
                    }
                    className="h-4 w-4 rounded border-border-strong"
                  />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/cars/${car.id}`} className="font-medium hover:underline">
                    {car.year} {car.make} {car.model}
                    {car.variant ? ` ${car.variant}` : ""}
                  </Link>
                  <div className="text-xs text-fg-muted">
                    {[car.colour, car.transmission, car.fuel_type]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </td>
                <td className="px-4 py-3 text-fg-muted">{formatMileage(car.mileage)}</td>
                <td className="px-4 py-3 font-medium">{formatPrice(car.price_pence)}</td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[car.status]}>{car.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <CopyLinkButton
                    url={`${publicBaseUrl}/car/${car.slug}`}
                    label={`/car/${car.slug}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}
