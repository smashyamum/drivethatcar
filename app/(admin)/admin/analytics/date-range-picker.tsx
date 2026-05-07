"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PRESETS: Array<{ label: string; days: number }> = [
  { label: "3d", days: 3 },
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function DateRangePicker({
  fromDate,
  toDate,
}: {
  fromDate: string;
  toDate: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [from, setFrom] = useState(fromDate);
  const [to, setTo] = useState(toDate);

  const apply = (newFrom: string, newTo: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("from", newFrom);
    next.set("to", newTo);
    router.push(`/admin/analytics?${next.toString()}`);
  };

  const applyPreset = (days: number) => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    const newFrom = isoDate(start);
    const newTo = isoDate(today);
    setFrom(newFrom);
    setTo(newTo);
    apply(newFrom, newTo);
  };

  return (
    <div className="flex flex-col gap-3 rounded-[12px] border border-border bg-bg p-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="from" className="text-xs font-medium text-fg-muted">
            From
          </label>
          <Input
            id="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 w-40"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="to" className="text-xs font-medium text-fg-muted">
            To
          </label>
          <Input
            id="to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 w-40"
          />
        </div>
        <Button
          type="button"
          onClick={() => apply(from, to)}
          className="h-9"
        >
          Apply
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            onClick={() => applyPreset(p.days)}
            className="rounded-md border border-border bg-bg px-3 py-1.5 text-xs font-medium text-fg-muted hover:bg-bg-subtle hover:text-fg"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
