"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createAdminBooking,
  type CreateBookingState,
} from "./actions";

type CarOption = {
  id: string;
  label: string;
};

type CustomerOption = {
  id: string;
  label: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating booking…" : "Create booking"}
    </Button>
  );
}

export function CreateBookingForm({
  cars,
  customers,
  defaultStart,
}: {
  cars: CarOption[];
  customers: CustomerOption[];
  /** Default value for the datetime-local input — "YYYY-MM-DDTHH:mm" in the org's tz. */
  defaultStart: string;
}) {
  const [state, formAction] = useActionState<CreateBookingState, FormData>(
    createAdminBooking,
    {},
  );
  const [customerMode, setCustomerMode] = useState<"existing" | "new">(
    customers.length > 0 ? "existing" : "new",
  );
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {/* Customer */}
      <section className="flex flex-col gap-3 rounded-[12px] border border-border bg-bg p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Customer</h2>
            <p className="text-xs text-fg-muted">
              Pick an existing lead or add a new one without leaving this page.
            </p>
          </div>
          <div className="inline-flex rounded-md border border-border bg-bg-subtle p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setCustomerMode("existing")}
              className={`rounded-[5px] px-3 py-1.5 ${customerMode === "existing" ? "bg-bg text-fg shadow-sm" : "text-fg-muted hover:text-fg"}`}
              disabled={customers.length === 0}
            >
              Existing
            </button>
            <button
              type="button"
              onClick={() => setCustomerMode("new")}
              className={`rounded-[5px] px-3 py-1.5 ${customerMode === "new" ? "bg-bg text-fg shadow-sm" : "text-fg-muted hover:text-fg"}`}
            >
              + New lead
            </button>
          </div>
        </div>

        <input type="hidden" name="customerMode" value={customerMode} />

        {customerMode === "existing" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customerId">Choose lead</Label>
            <Select id="customerId" name="customerId" defaultValue="">
              <option value="" disabled>
                — Pick a lead —
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
            {fe.customerId && (
              <p className="text-xs text-red-700">{fe.customerId}</p>
            )}
            {customers.length === 0 && (
              <p className="text-xs text-fg-muted">
                No leads yet — switch to <span className="font-medium">+ New lead</span> above.
              </p>
            )}
          </div>
        )}

        {customerMode === "new" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Jane Smith"
                required
                minLength={2}
              />
              {fe.name && <p className="text-xs text-red-700">{fe.name}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" placeholder="+44 7700 900000" required />
              {fe.phone && <p className="text-xs text-red-700">{fe.phone}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="jane@example.com"
              />
              {fe.email && <p className="text-xs text-red-700">{fe.email}</p>}
            </div>
            <p className="col-span-full text-xs text-fg-muted">
              The new lead will be assigned to you and saved to your customers list.
            </p>
          </div>
        )}
      </section>

      {/* Car + type + when */}
      <section className="flex flex-col gap-4 rounded-[12px] border border-border bg-bg p-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Booking details</h2>
          <p className="text-xs text-fg-muted">
            Customers will get a confirmation email and a link to manage the
            booking themselves.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="carId">Car</Label>
            <Select id="carId" name="carId" defaultValue="" required>
              <option value="" disabled>
                — Pick a car —
              </option>
              {cars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
            {fe.carId && <p className="text-xs text-red-700">{fe.carId}</p>}
            {cars.length === 0 && (
              <p className="text-xs text-fg-muted">
                No available cars — add one in <span className="font-medium">Cars</span>.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type">Type</Label>
            <Select id="type" name="type" defaultValue="viewing" required>
              <option value="viewing">Viewing</option>
              <option value="test_drive">Test drive</option>
            </Select>
            {fe.type && <p className="text-xs text-red-700">{fe.type}</p>}
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="startLocal">When</Label>
            <Input
              id="startLocal"
              name="startLocal"
              type="datetime-local"
              defaultValue={defaultStart}
              required
              className="w-full sm:max-w-xs"
            />
            <p className="text-xs text-fg-muted">
              Times are in your dealership&rsquo;s timezone (set in Settings).
            </p>
            {fe.startLocal && (
              <p className="text-xs text-red-700">{fe.startLocal}</p>
            )}
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
