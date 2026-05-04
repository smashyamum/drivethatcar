import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTimeInTz } from "@/lib/tz";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  LEAD_STATUS_TONE,
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
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
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

  // Secondary sort: most recent booking first when no follow-up.
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

  const now = new Date();

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

      {customers.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-border-strong bg-bg-subtle p-8 text-center text-sm text-fg-muted">
          {q || status
            ? "No matches."
            : "No leads yet — they'll appear here once they book or you add them manually."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-border bg-bg">
          <table className="w-full text-sm">
            <thead className="bg-bg-subtle text-left text-xs uppercase tracking-wide text-fg-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Bookings</th>
                <th className="px-4 py-3">Follow-up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((c) => {
                const bookings = c.bookings ?? [];
                const followUp = c.next_follow_up_at ? new Date(c.next_follow_up_at) : null;
                const overdue = followUp && followUp < now;
                return (
                  <tr key={c.id} className="hover:bg-bg-subtle">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="font-medium hover:underline"
                      >
                        {c.name}
                      </Link>
                      {c.lead_source && (
                        <div className="text-xs text-fg-muted">via {c.lead_source}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={LEAD_STATUS_TONE[c.lead_status]}>
                        {LEAD_STATUS_LABEL[c.lead_status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-fg">{c.phone}</div>
                      <div className="text-xs text-fg-muted">{c.email}</div>
                    </td>
                    <td className="px-4 py-3 text-fg-muted">{bookings.length}</td>
                    <td className="px-4 py-3">
                      {followUp ? (
                        <span className={overdue ? "font-semibold text-red-700" : "text-fg"}>
                          {formatDateTimeInTz(followUp, tz)}
                          {overdue ? " · overdue" : ""}
                        </span>
                      ) : (
                        <span className="text-fg-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
