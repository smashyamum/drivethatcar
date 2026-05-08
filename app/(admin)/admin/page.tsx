import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/tenant";
import { isPro } from "@/lib/plan";
import { formatDateTimeInTz } from "@/lib/tz";
import { defaultRange, loadAggregateStats, type AggregateStats } from "@/lib/stats";
import {
  LEAD_STATUS_LABEL,
  LEAD_STATUS_TONE,
  type Booking,
  type Car,
  type Customer,
  type LeadStatus,
  type Settings,
} from "@/lib/supabase/types";

export const metadata = { title: "Dashboard · Admin" };

const TYPE_LABEL = { viewing: "Viewing", test_drive: "Test drive" } as const;

type UpcomingBooking = Pick<Booking, "id" | "start_at" | "type" | "reference"> & {
  car: Pick<Car, "year" | "make" | "model" | "variant"> | null;
  customer: Pick<Customer, "name" | "phone"> | null;
};

type OverdueLead = Pick<Customer, "id" | "name" | "phone" | "lead_status" | "next_follow_up_at">;

export default async function AdminDashboard() {
  const supabase = await createSupabaseServerClient();
  const { id: orgId, plan, role } = await getActiveOrg();
  const proAccess = isPro(plan);
  const isSalesRole = role === "sales";
  const now = new Date();
  const nowIso = now.toISOString();
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Sales reps only see their own performance, not the team's. Owner/Admin
  // see the team aggregate.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const myUserId = user?.id ?? null;
  const analyticsStats = await loadAggregateStats(
    orgId,
    defaultRange(7),
    isSalesRole ? myUserId : null,
  );

  const [
    { count: carsAvailable },
    { count: carsTotal },
    { count: upcomingBookingsCount },
    { count: leadsTotal },
    { count: hotLeads },
    { count: overdueLeads },
    { count: leadsThisMonth },
    { data: nextBookingsRaw },
    { data: overdueRowsRaw },
    { data: settingsData },
  ] = await Promise.all([
    supabase
      .from("cars")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "available"),
    supabase.from("cars").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "confirmed")
      .gte("start_at", nowIso)
      .lte("start_at", in7d),
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("lead_status", "hot"),
    supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .lt("next_follow_up_at", nowIso),
    supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", last30d),
    supabase
      .from("bookings")
      .select(
        "id, start_at, type, reference, car:cars(year, make, model, variant), customer:customers(name, phone)",
      )
      .eq("organization_id", orgId)
      .eq("status", "confirmed")
      .gte("start_at", nowIso)
      .order("start_at", { ascending: true })
      .limit(5),
    supabase
      .from("customers")
      .select("id, name, phone, lead_status, next_follow_up_at")
      .eq("organization_id", orgId)
      .lt("next_follow_up_at", nowIso)
      .order("next_follow_up_at", { ascending: true })
      .limit(5),
    supabase.from("settings").select("*").eq("organization_id", orgId).single(),
  ]);

  const tz = (settingsData as Settings | null)?.timezone ?? "Asia/Dubai";
  const nextBookings = (nextBookingsRaw ?? []) as unknown as UpcomingBooking[];
  const overdueRows = (overdueRowsRaw ?? []) as unknown as OverdueLead[];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-fg-muted">
          What&rsquo;s happening across your stock, bookings, and leads.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          href="/admin/cars"
          label="Cars available"
          value={carsAvailable ?? 0}
          sub={`${carsTotal ?? 0} total in system`}
        />
        <KpiCard
          href="/admin/bookings"
          label="Bookings next 7 days"
          value={upcomingBookingsCount ?? 0}
          sub="Confirmed only"
        />
        <KpiCard
          href="/admin/customers"
          label="Total leads"
          value={leadsTotal ?? 0}
          sub={`${leadsThisMonth ?? 0} new in last 30 days`}
        />
        <KpiCard
          href="/admin/customers?status=hot"
          label="Hot leads"
          value={hotLeads ?? 0}
          sub={`${overdueLeads ?? 0} follow-ups overdue`}
          tone={(overdueLeads ?? 0) > 0 ? "danger" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Coming up</CardDescription>
            <CardTitle>Next bookings</CardTitle>
          </CardHeader>
          {nextBookings.length === 0 ? (
            <p className="text-sm text-fg-muted">No upcoming confirmed bookings.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {nextBookings.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/admin/bookings/${b.id}`}
                    className="flex items-baseline justify-between gap-3 py-3 text-sm hover:bg-bg-subtle"
                  >
                    <div>
                      <div className="font-medium">
                        {formatDateTimeInTz(new Date(b.start_at), tz)}
                      </div>
                      <div className="text-xs text-fg-muted">
                        {b.customer?.name ?? "—"}
                        {b.car
                          ? ` · ${b.car.year} ${b.car.make} ${b.car.model}${b.car.variant ? ` ${b.car.variant}` : ""}`
                          : ""}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-bg-subtle px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                      {TYPE_LABEL[b.type]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <Link href="/admin/bookings" className="text-sm font-medium hover:underline">
              All bookings →
            </Link>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Needs a chase</CardDescription>
            <CardTitle>Overdue follow-ups</CardTitle>
          </CardHeader>
          {overdueRows.length === 0 ? (
            <p className="text-sm text-fg-muted">Nothing overdue. Nice work.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {overdueRows.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/customers/${c.id}`}
                    className="flex items-baseline justify-between gap-3 py-3 text-sm hover:bg-bg-subtle"
                  >
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-fg-muted">
                        {c.phone}
                        {c.next_follow_up_at &&
                          ` · due ${formatDateTimeInTz(new Date(c.next_follow_up_at), tz)}`}
                      </div>
                    </div>
                    <Badge tone={LEAD_STATUS_TONE[c.lead_status as LeadStatus]}>
                      {LEAD_STATUS_LABEL[c.lead_status as LeadStatus]}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <Link href="/admin/customers" className="text-sm font-medium hover:underline">
              All leads →
            </Link>
          </div>
        </Card>
      </div>

      <AnalyticsTeaser
        proAccess={proAccess}
        stats={analyticsStats}
        isSalesRole={isSalesRole}
      />

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
          Quick actions
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink href="/admin/cars/new" label="+ Add car" />
          <QuickLink href="/admin/cars/import" label="Import CSV" />
          <QuickLink href="/admin/customers/new" label="+ New lead" />
          <QuickLink href="/admin/settings" label="Settings" />
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  href,
  label,
  value,
  sub,
  tone = "default",
}: {
  href: string;
  label: string;
  value: number;
  sub?: string;
  tone?: "default" | "danger";
}) {
  return (
    <Link href={href} className="block">
      <Card className="h-full transition-colors hover:bg-bg-subtle">
        <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
          {label}
        </p>
        <p
          className={`mt-2 text-3xl font-semibold tracking-tight ${tone === "danger" ? "text-red-700" : "text-fg"}`}
        >
          {value}
        </p>
        {sub && <p className="mt-1 text-xs text-fg-muted">{sub}</p>}
      </Card>
    </Link>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center rounded-[12px] border border-border bg-bg px-4 py-3 text-sm font-medium hover:bg-bg-subtle"
    >
      {label}
    </Link>
  );
}

function AnalyticsTeaser({
  proAccess,
  stats,
  isSalesRole,
}: {
  proAccess: boolean;
  stats: AggregateStats;
  isSalesRole: boolean;
}) {
  const fmtPct = (v: number | null) => (v == null ? "—" : `${Math.round(v)}%`);
  const heading = isSalesRole
    ? "Your performance — last 7 days"
    : "Analytics — last 7 days";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
          {heading}
        </h2>
        {proAccess ? (
          <Link href="/admin/analytics" className="text-xs font-medium hover:underline">
            Full report →
          </Link>
        ) : (
          <span className="rounded-full bg-fg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bg">
            Pro
          </span>
        )}
      </div>
      <div className="relative mt-3 min-h-[200px] overflow-hidden rounded-[12px] border border-border bg-bg">
        <div
          className={`grid grid-cols-2 gap-4 p-6 sm:grid-cols-4 ${proAccess ? "" : "pointer-events-none select-none blur-[6px]"}`}
        >
          <TeaserStat label="Bookings" value={String(stats.bookings)} />
          <TeaserStat label="Sales closed" value={String(stats.sales)} />
          <TeaserStat label="Conversion" value={fmtPct(stats.conversionRate)} />
          <TeaserStat label="No-show rate" value={fmtPct(stats.noShowRate)} />
        </div>
        {!proAccess && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-bg/40 px-6 py-10 text-center backdrop-blur-[2px]">
            <p className="text-lg font-semibold tracking-tight">
              Unlock sales analytics &amp; leaderboards
            </p>
            <p className="max-w-md text-sm text-fg-muted">
              See conversion rates, sales by team member, no-show rates and per-car
              performance — all included with Pro.
            </p>
            <Link
              href="/admin/settings/billing"
              className="mt-1 inline-flex items-center justify-center rounded-md bg-fg px-5 py-2.5 text-sm font-semibold text-bg shadow-sm hover:opacity-90"
            >
              Upgrade to Pro
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function TeaserStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
