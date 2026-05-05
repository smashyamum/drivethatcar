"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTimeInTz } from "@/lib/tz";
import {
  LEAD_STATUS_LABEL,
  LEAD_STATUS_TONE,
  type Customer,
  type LeadStatus,
} from "@/lib/supabase/types";
import { deleteLeads } from "@/app/(admin)/admin/customers/actions";

type Row = Customer & {
  bookingCount: number;
  lastBookingAt: string | null;
};

export function CustomerBulkList({
  customers,
  q,
  status,
  tz,
  nowIso,
}: {
  customers: Row[];
  q: string;
  status: string;
  tz: string;
  nowIso: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const now = useMemo(() => new Date(nowIso), [nowIso]);

  const allIds = useMemo(() => customers.map((c) => c.id), [customers]);
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
      customers
        .filter((c) => selected.has(c.id))
        .reduce((sum, c) => sum + c.bookingCount, 0),
    [customers, selected],
  );

  function onDeleteClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (selected.size === 0) {
      e.preventDefault();
      return;
    }
    const msg =
      selectedBookings > 0
        ? `Permanently delete ${selected.size} lead${selected.size === 1 ? "" : "s"} AND their ${selectedBookings} booking${selectedBookings === 1 ? "" : "s"}? This can't be undone.`
        : `Permanently delete ${selected.size} lead${selected.size === 1 ? "" : "s"}? This can't be undone.`;
    if (!window.confirm(msg)) e.preventDefault();
  }

  if (customers.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-border-strong bg-bg-subtle p-8 text-center text-sm text-fg-muted">
        {q || status
          ? "No matches."
          : "No leads yet — they'll appear here once they book or you add them manually."}
      </div>
    );
  }

  return (
    <form ref={formRef} action={deleteLeads} className="flex flex-col gap-3">
      <input type="hidden" name="q" value={q} />
      <input type="hidden" name="status" value={status} />
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

      <div className="overflow-hidden rounded-[12px] border border-border bg-bg">
        <table className="w-full text-sm">
          <thead className="bg-bg-subtle text-left text-xs uppercase tracking-wide text-fg-muted">
            <tr>
              <th className="w-10 px-4 py-3"></th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Bookings</th>
              <th className="px-4 py-3">Follow-up</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.map((c) => {
              const followUp = c.next_follow_up_at ? new Date(c.next_follow_up_at) : null;
              const overdue = followUp && followUp < now;
              return (
                <tr key={c.id} className="hover:bg-bg-subtle">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                      title={
                        c.bookingCount > 0
                          ? `Has ${c.bookingCount} booking${c.bookingCount === 1 ? "" : "s"} — they'll be deleted too`
                          : "Select"
                      }
                      className="h-4 w-4 rounded border-border-strong"
                    />
                  </td>
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
                    <Badge tone={LEAD_STATUS_TONE[c.lead_status as LeadStatus]}>
                      {LEAD_STATUS_LABEL[c.lead_status as LeadStatus]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-fg">{c.phone}</div>
                    <div className="text-xs text-fg-muted">{c.email}</div>
                  </td>
                  <td className="px-4 py-3 text-fg-muted">{c.bookingCount}</td>
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
    </form>
  );
}
