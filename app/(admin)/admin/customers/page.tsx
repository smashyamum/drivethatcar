import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CustomerBulkList } from "@/components/admin/customer-bulk-list";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  type Customer,
  type LeadStatus,
  type Settings,
} from "@/lib/supabase/types";

export const metadata = { title: "Customers · Admin" };

type CustomerRow = Customer & {
  bookings: Array<{ id: string; start_at: string; status: string }> | null;
};

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    deleted?: string;
    bookings?: string;
    error?: string;
  }>;
}) {
  const { q, status, deleted, bookings, error } = await searchParams;
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("customers")
    .select("*, bookings(id, start_at, status)");

  if (q && q.trim()) {
    const term = q.trim();
    const escaped = term.replace(/[%,]/g, "");
    query = query.or(
      `name.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%`,
    );
  }
  if (status && (LEAD_STATUSES as string[]).includes(status)) {
    query = query.eq("lead_status", status);
  }

  const [{ data: customerData }, { data: settingsData }] = await Promise.all([
    query.order("next_follow_up_at", { ascending: true, nullsFirst: false }),
    supabase.from("settings").select("*").eq("id", 1).single(),
  ]);

  const customers = (customerData ?? []) as unknown as CustomerRow[];
  const tz = (settingsData as Settings | null)?.timezone ?? "Asia/Dubai";

  customers.sort((a, b) => {
    if (a.next_follow_up_at && b.next_follow_up_at) {
      return a.next_follow_up_at < b.next_follow_up_at ? -1 : 1;
    }
    if (a.next_follow_up_at) return -1;
    if (b.next_follow_up_at) return 1;
    const aLast = (a.bookings ?? [])[0]?.start_at ?? a.created_at;
    const bLast = (b.bookings ?? [])[0]?.start_at ?? b.created_at;
    return aLast < bLast ? 1 : -1;
  });

  const rows = customers.map((c) => {
    const bs = c.bookings ?? [];
    const last = bs.slice().sort((a, b) => (a.start_at < b.start_at ? 1 : -1))[0];
    return {
      ...c,
      bookingCount: bs.length,
      lastBookingAt: last?.start_at ?? null,
    };
  });

  const deletedN = deleted ? Number(deleted) : 0;
  const bookingsN = bookings ? Number(bookings) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {customers.length} {customers.length === 1 ? "lead" : "leads"}
            {q ? ` matching "${q}"` : ""}
            {status ? ` · ${LEAD_STATUS_LABEL[status as LeadStatus]}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/admin/customers/export">
            <Button variant="secondary">Export CSV</Button>
          </a>
          <Link href="/admin/customers/new">
            <Button>+ New lead</Button>
          </Link>
        </div>
      </div>

      {deletedN > 0 && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Deleted {deletedN} lead{deletedN === 1 ? "" : "s"}
          {bookingsN > 0 &&
            ` and ${bookingsN} booking${bookingsN === 1 ? "" : "s"}`}
          .
        </p>
      )}
      {error === "none_selected" && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Select at least one lead to delete.
        </p>
      )}
      {error && error !== "none_selected" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          Delete failed: {error}
        </p>
      )}

      <form action="/admin/customers" method="get" className="flex flex-wrap gap-2">
        <Input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name, phone, or email…"
          className="max-w-sm"
        />
        <Select name="status" defaultValue={status ?? ""} className="max-w-[180px]">
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {(q || status) && (
          <a href="/admin/customers" className="self-center text-sm text-fg-muted hover:text-fg">
            Clear
          </a>
        )}
      </form>

      <CustomerBulkList
        customers={rows}
        q={q ?? ""}
        status={status ?? ""}
        tz={tz}
        nowIso={new Date().toISOString()}
      />
    </div>
  );
}
