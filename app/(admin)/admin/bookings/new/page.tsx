import Link from "next/link";
import { addHours } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/tenant";
import type { Settings } from "@/lib/supabase/types";
import { CreateBookingForm } from "./create-booking-form";

export const metadata = { title: "New booking · Admin" };

/** Builds a default "tomorrow at 10:00" string for the datetime-local input,
 *  rendered in the org's configured timezone. */
function defaultStartFor(timezone: string): string {
  const tomorrow = addHours(new Date(), 24);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(tomorrow);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T10:00`;
}

export default async function NewBookingPage() {
  const supabase = await createSupabaseServerClient();
  const orgId = await getActiveOrgId();

  const [{ data: cars }, { data: customers }, { data: settingsRow }] =
    await Promise.all([
      supabase
        .from("cars")
        .select("id, year, make, model, variant, status")
        .eq("organization_id", orgId)
        .eq("status", "available")
        .order("created_at", { ascending: false }),
      // RLS keeps Sales reps to only their own + unassigned leads, which is
      // exactly the right scope for who they can book on behalf of.
      supabase
        .from("customers")
        .select("id, name, phone, email")
        .eq("organization_id", orgId)
        .order("name", { ascending: true }),
      supabase
        .from("settings")
        .select("timezone")
        .eq("organization_id", orgId)
        .single(),
    ]);

  const settings = settingsRow as Pick<Settings, "timezone"> | null;
  const tz = settings?.timezone ?? "Asia/Dubai";

  const carOptions = (cars ?? []).map((c) => ({
    id: c.id as string,
    label: `${c.year} ${c.make} ${c.model}${c.variant ? ` ${c.variant}` : ""}`,
  }));

  const customerOptions = (customers ?? []).map((c) => ({
    id: c.id as string,
    label: `${c.name} · ${c.phone}${c.email ? ` · ${c.email}` : ""}`,
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New booking</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Book a viewing or test drive on behalf of a customer.
          </p>
        </div>
        <Link href="/admin/bookings" className="text-sm text-fg-muted hover:text-fg">
          ← Back
        </Link>
      </div>

      <CreateBookingForm
        cars={carOptions}
        customers={customerOptions}
        defaultStart={defaultStartFor(tz)}
      />
    </div>
  );
}
