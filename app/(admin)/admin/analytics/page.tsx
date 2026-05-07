import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveMembership, getActiveOrg } from "@/lib/tenant";
import {
  isoToInputDate,
  loadAggregateStats,
  loadLeaderboard,
  rangeFromQuery,
} from "@/lib/stats";
import { DateRangePicker } from "./date-range-picker";

export const metadata = { title: "Analytics · Admin" };

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value)}%`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { role } = await getActiveMembership();
  const org = await getActiveOrg();

  if (!org.limits.analytics) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>Analytics</CardDescription>
          <CardTitle>Analytics is a Pro feature</CardTitle>
        </CardHeader>
        <p className="text-sm text-fg-muted">
          See conversion rates, sales by team member, no-show rates and per-car
          performance — all included with Pro.
        </p>
        <div className="mt-4">
          <Link
            href="/admin/settings/billing"
            className="inline-flex items-center justify-center rounded-md bg-fg px-4 py-2 text-sm font-semibold text-bg hover:opacity-90"
          >
            Upgrade to Pro
          </Link>
        </div>
      </Card>
    );
  }

  const range = rangeFromQuery(params.from, params.to);
  const fromDate = isoToInputDate(range.fromIso);
  const toDate = isoToInputDate(range.toIso);

  // Sales sees only their own stats. Owner/Admin see the full team.
  const isManager = role === "owner" || role === "admin";

  const myStats = await loadAggregateStats(
    org.id,
    range,
    isManager ? null : (await getCurrentUserId()),
  );

  const leaderboard = isManager ? await loadLeaderboard(org.id, range) : [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-fg-muted">
          {isManager
            ? "Team performance over the chosen date range."
            : "Your own performance over the chosen date range."}
        </p>
      </div>

      <DateRangePicker fromDate={fromDate} toDate={toDate} />

      {/* Top-line stats */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Bookings" value={String(myStats.bookings)} />
        <StatCard label="Sales closed" value={String(myStats.sales)} />
        <StatCard label="Conversion" value={formatPercent(myStats.conversionRate)} />
        <StatCard label="No-show rate" value={formatPercent(myStats.noShowRate)} />
      </section>

      {/* Leaderboard (managers only) */}
      {isManager && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
            Team leaderboard
          </h2>
          <div className="overflow-hidden rounded-[12px] border border-border bg-bg">
            <table className="w-full text-sm">
              <thead className="bg-bg-subtle text-left text-xs uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="px-4 py-3">Salesperson</th>
                  <th className="px-4 py-3 text-right">Bookings</th>
                  <th className="px-4 py-3 text-right">Sales</th>
                  <th className="px-4 py-3 text-right">Conversion</th>
                  <th className="px-4 py-3 text-right">No-show rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leaderboard.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-fg-muted">
                      No team members yet.
                    </td>
                  </tr>
                )}
                {leaderboard.map((row) => (
                  <tr key={row.user_id}>
                    <td className="px-4 py-3 font-medium">{row.email}</td>
                    <td className="px-4 py-3 text-right">{row.bookings}</td>
                    <td className="px-4 py-3 text-right font-semibold">{row.sales}</td>
                    <td className="px-4 py-3 text-right">
                      {formatPercent(row.conversionRate)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatPercent(row.noShowRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-border bg-bg p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

// Helper: read the auth user's id without re-creating the supabase client elsewhere.
import { createSupabaseServerClient } from "@/lib/supabase/server";
async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
