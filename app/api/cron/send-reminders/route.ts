import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendReminderEmail } from "@/lib/email/booking-emails";
import type { Booking } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Hourly cron — sends a reminder email for every confirmed booking starting
 * within the next 24 hours that hasn't already had its reminder sent.
 *
 * Authenticated via Vercel's CRON_SECRET (sent as `Authorization: Bearer ...`).
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
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data, error } = await service
    .from("bookings")
    .select("*")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
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
    if (!booking.manage_token) {
      // Older bookings created before plain-token storage — skip with a marker
      // so we don't try them every hour.
      skipped++;
      await service
        .from("bookings")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", booking.id);
      continue;
    }

    try {
      await sendReminderEmail(booking.id, booking.manage_token);
      await service
        .from("bookings")
        .update({ reminder_sent_at: new Date().toISOString() })
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
