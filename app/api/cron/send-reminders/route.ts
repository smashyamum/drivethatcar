import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendReminderEmail } from "@/lib/email/booking-emails";
import type { Booking } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const CRON_INTERVAL_HOURS = 24;

/**
 * Daily cron — fires reminder emails for upcoming confirmed bookings.
 *
 * Settings.reminder_offsets_hours holds the schedule (e.g. {72,24} = remind
 * 3 days and 1 day before). For each unsent offset whose nominal send time
 * has just passed (within one cron interval), we send the email and append
 * the offset to bookings.reminder_offsets_sent.
 *
 * To avoid double-emailing when two offsets fall in the same cron tick,
 * we send only the smallest eligible offset per booking per run.
 *
 * Authenticated via Vercel's CRON_SECRET (`Authorization: Bearer ...`).
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createSupabaseServiceClient();

  // Multi-tenant: every org sets its own reminder schedule. Build a map
  // organization_id → offsets so we can resolve per-booking below.
  const { data: allSettings, error: settingsError } = await service
    .from("settings")
    .select("organization_id, reminder_offsets_hours");
  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 500 });
  }
  const offsetsByOrg = new Map<string, number[]>();
  for (const row of allSettings ?? []) {
    const offsets = ((row.reminder_offsets_hours as number[] | null) ?? [24]).filter(
      (n) => n > 0,
    );
    offsetsByOrg.set(row.organization_id as string, offsets);
  }

  const allOffsets = Array.from(offsetsByOrg.values()).flat();
  if (allOffsets.length === 0) {
    return NextResponse.json({ ok: true, found: 0, sent: 0, skipped: 0, failures: [] });
  }

  const now = new Date();
  const maxOffsetH = Math.max(...allOffsets);
  const windowEnd = new Date(now.getTime() + maxOffsetH * 60 * 60 * 1000);

  const { data, error } = await service
    .from("bookings")
    .select("*")
    .eq("status", "confirmed")
    .gt("start_at", now.toISOString())
    .lte("start_at", windowEnd.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bookings = (data ?? []) as Booking[];
  let sent = 0;
  let skipped = 0;
  const failures: Array<{ id: string; error: string }> = [];

  for (const booking of bookings) {
    const offsets = offsetsByOrg.get(booking.organization_id) ?? [24];
    const sentOffsets = new Set(booking.reminder_offsets_sent ?? []);
    const hoursUntilStart = (new Date(booking.start_at).getTime() - now.getTime()) / 3_600_000;

    // Eligible: offset hasn't been sent AND we're inside its [offset-interval, offset] window.
    const eligible = offsets
      .filter((o) => !sentOffsets.has(o))
      .filter((o) => hoursUntilStart <= o && hoursUntilStart >= o - CRON_INTERVAL_HOURS)
      .sort((a, b) => a - b);

    const offsetToSend = eligible[0];
    if (offsetToSend === undefined) {
      skipped++;
      continue;
    }

    if (!booking.manage_token) {
      // Pre-M5 booking with no plain token — can't build manage links.
      // Mark this org's configured offsets sent so we don't keep retrying.
      await service
        .from("bookings")
        .update({
          reminder_offsets_sent: Array.from(new Set([...sentOffsets, ...offsets])),
        })
        .eq("id", booking.id);
      skipped++;
      continue;
    }

    try {
      await sendReminderEmail(booking.id, booking.manage_token, offsetToSend);
      const newSent = Array.from(new Set([...sentOffsets, offsetToSend]));
      await service
        .from("bookings")
        .update({ reminder_offsets_sent: newSent })
        .eq("id", booking.id);
      sent++;
    } catch (err) {
      failures.push({
        id: booking.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    found: bookings.length,
    sent,
    skipped,
    failures,
  });
}
