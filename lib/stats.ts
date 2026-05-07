import "server-only";
import { createSupabaseServiceClient } from "./supabase/service";

export type StatRange = {
  /** Start of window, inclusive (ISO). */
  fromIso: string;
  /** End of window, exclusive (ISO). */
  toIso: string;
};

export type AggregateStats = {
  bookings: number;
  bookingsCancelled: number;
  bookingsNoShow: number;
  bookingsCompleted: number;
  sales: number;
  /** % of customers who booked in window that are now `lead_status='sold'`. */
  conversionRate: number | null;
  /** % of past bookings (completed + no_show) that were no-shows. */
  noShowRate: number | null;
};

export type LeaderboardRow = {
  user_id: string;
  email: string;
  bookings: number;
  sales: number;
  noShowRate: number | null;
  conversionRate: number | null;
};

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function defaultRange(days = 7): StatRange {
  const to = new Date();
  to.setUTCHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  from.setUTCHours(0, 0, 0, 0);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

export function rangeFromQuery(
  fromParam: string | undefined,
  toParam: string | undefined,
): StatRange {
  if (!fromParam && !toParam) return defaultRange(7);
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);

  const parseDate = (s: string | undefined, fallback: Date, endOfDay: boolean) => {
    if (!s) return fallback;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return fallback;
    if (endOfDay) d.setUTCHours(23, 59, 59, 999);
    else d.setUTCHours(0, 0, 0, 0);
    return d;
  };

  const lastWeek = new Date(today);
  lastWeek.setUTCDate(lastWeek.getUTCDate() - 6);
  lastWeek.setUTCHours(0, 0, 0, 0);

  const from = parseDate(fromParam, lastWeek, false);
  const to = parseDate(toParam, today, true);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

export function isoToInputDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Aggregate stats — used by /admin/analytics top-line cards and dashboard teaser.
// ---------------------------------------------------------------------------

export async function loadAggregateStats(
  orgId: string,
  range: StatRange,
  /** When set, only count rows assigned to this user. */
  assignedTo?: string | null,
): Promise<AggregateStats> {
  const service = createSupabaseServiceClient();

  // Bookings created in window.
  let bookingsQuery = service
    .from("bookings")
    .select("id, status, customer_id, created_at, assigned_to")
    .eq("organization_id", orgId)
    .gte("created_at", range.fromIso)
    .lte("created_at", range.toIso);
  if (assignedTo) bookingsQuery = bookingsQuery.eq("assigned_to", assignedTo);
  const { data: bookings } = await bookingsQuery;

  const list = bookings ?? [];
  const bookingsCount = list.length;
  const cancelled = list.filter((b) => b.status === "cancelled").length;
  const completed = list.filter((b) => b.status === "completed").length;
  const noShow = list.filter((b) => b.status === "no_show").length;

  // Sales in window: customers whose sold_at falls inside the window.
  let salesQuery = service
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("lead_status", "sold")
    .gte("sold_at", range.fromIso)
    .lte("sold_at", range.toIso);
  if (assignedTo) salesQuery = salesQuery.eq("assigned_to", assignedTo);
  const { count: salesCount } = await salesQuery;

  // Conversion: of unique customers who booked in window, how many are now sold.
  const customerIds = Array.from(
    new Set(list.map((b) => (b as { customer_id: string }).customer_id)),
  );
  let conversionRate: number | null = null;
  if (customerIds.length > 0) {
    let convQuery = service
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("lead_status", "sold")
      .in("id", customerIds);
    if (assignedTo) convQuery = convQuery.eq("assigned_to", assignedTo);
    const { count: convertedCount } = await convQuery;
    conversionRate = customerIds.length > 0
      ? ((convertedCount ?? 0) / customerIds.length) * 100
      : null;
  }

  const pastBookings = completed + noShow;
  const noShowRate = pastBookings > 0 ? (noShow / pastBookings) * 100 : null;

  return {
    bookings: bookingsCount,
    bookingsCancelled: cancelled,
    bookingsNoShow: noShow,
    bookingsCompleted: completed,
    sales: salesCount ?? 0,
    conversionRate,
    noShowRate,
  };
}

// ---------------------------------------------------------------------------
// Leaderboard — one row per team member.
// ---------------------------------------------------------------------------

export async function loadLeaderboard(
  orgId: string,
  range: StatRange,
): Promise<LeaderboardRow[]> {
  const service = createSupabaseServiceClient();

  const { data: memberships } = await service
    .from("memberships")
    .select("user_id, role")
    .eq("organization_id", orgId)
    .order("role", { ascending: true });

  const rows: LeaderboardRow[] = await Promise.all(
    (memberships ?? []).map(async (m) => {
      const userId = m.user_id as string;
      const stats = await loadAggregateStats(orgId, range, userId);
      const { data } = await service.auth.admin.getUserById(userId);
      return {
        user_id: userId,
        email: data?.user?.email ?? "(unknown)",
        bookings: stats.bookings,
        sales: stats.sales,
        noShowRate: stats.noShowRate,
        conversionRate: stats.conversionRate,
      };
    }),
  );

  return rows.sort((a, b) => b.sales - a.sales);
}

// ---------------------------------------------------------------------------
// Per-car stats — used on the car detail page.
// ---------------------------------------------------------------------------

export type CarStats = {
  totalBookings: number;
  bookingsToSell: number | null;
  daysOnLot: number;
};

export async function loadCarStats(carId: string): Promise<CarStats> {
  const service = createSupabaseServiceClient();
  const { data: car } = await service
    .from("cars")
    .select("created_at, sold_at, status")
    .eq("id", carId)
    .single();

  const created = car?.created_at ? new Date(car.created_at as string) : new Date();
  const soldAt = car?.sold_at ? new Date(car.sold_at as string) : null;

  const { count: totalBookings } = await service
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("car_id", carId);

  let bookingsToSell: number | null = null;
  if (soldAt) {
    const { count } = await service
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("car_id", carId)
      .lte("created_at", soldAt.toISOString());
    bookingsToSell = count ?? 0;
  }

  const endDate = soldAt ?? new Date();
  const daysOnLot = Math.max(
    0,
    Math.floor((endDate.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return {
    totalBookings: totalBookings ?? 0,
    bookingsToSell,
    daysOnLot,
  };
}
