import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LEAD_STATUS_LABEL, type Customer, type LeadStatus } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type Row = Customer & {
  bookings: Array<{ id: string; start_at: string; status: string }> | null;
  interested_car: { year: number; make: string; model: string; variant: string | null } | null;
};

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("customers")
    .select(
      "*, bookings(id, start_at, status), interested_car:cars!customers_interested_car_id_fkey(year, make, model, variant)",
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const customers = (data ?? []) as unknown as Row[];

  const headers = [
    "Name",
    "Phone",
    "Email",
    "Status",
    "Source",
    "Interested in",
    "Bookings",
    "Last booking",
    "Next follow-up",
    "Created",
  ];

  const lines = [headers.map(csvEscape).join(",")];

  for (const c of customers) {
    const bookings = c.bookings ?? [];
    const lastBooking = bookings.slice().sort((a, b) => (a.start_at < b.start_at ? 1 : -1))[0];
    const interested = c.interested_car
      ? `${c.interested_car.year} ${c.interested_car.make} ${c.interested_car.model}${c.interested_car.variant ? ` ${c.interested_car.variant}` : ""}`
      : "";
    lines.push(
      [
        c.name,
        c.phone,
        c.email,
        LEAD_STATUS_LABEL[c.lead_status as LeadStatus] ?? c.lead_status,
        c.lead_source ?? "",
        interested,
        bookings.length,
        lastBooking ? lastBooking.start_at : "",
        c.next_follow_up_at ?? "",
        c.created_at,
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="customers-${today}.csv"`,
    },
  });
}
