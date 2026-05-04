"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addMinutes } from "date-fns";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendRescheduleEmail } from "@/lib/email/booking-emails";
import { computeAvailableSlots } from "@/lib/slots/computeAvailableSlots";
import { verifyManageToken } from "@/lib/tokens";
import { formatLocalDateString, weekdayKeyInTz } from "@/lib/tz";
import type { Booking, Settings } from "@/lib/supabase/types";

const Schema = z.object({
  id: z.string().uuid(),
  token: z.string().min(1),
  startUtc: z.string().datetime(),
});

export type RescheduleState = { error?: string };

export async function rescheduleBooking(
  _prev: RescheduleState,
  formData: FormData,
): Promise<RescheduleState> {
  const parsed = Schema.safeParse({
    id: formData.get("id"),
    token: formData.get("token"),
    startUtc: formData.get("startUtc"),
  });
  if (!parsed.success) return { error: "Invalid input." };

  const { id, token, startUtc } = parsed.data;
  const service = createSupabaseServiceClient();

  const { data: bookingData } = await service
    .from("bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!bookingData) return { error: "Booking not found." };
  const booking = bookingData as Booking;
  if (!verifyManageToken(token, booking.manage_token_hash)) return { error: "Invalid link." };
  if (booking.status !== "confirmed") return { error: "This booking can't be rescheduled." };

  const newStart = new Date(startUtc);
  if (Number.isNaN(newStart.getTime())) return { error: "Invalid time." };
  if (newStart <= new Date()) return { error: "Pick a slot in the future." };

  // Validate slot is still available for this car
  const { data: settingsData } = await service.from("settings").select("*").eq("id", 1).single();
  const settings = settingsData as Settings;

  const localDate = formatLocalDateString(newStart);
  const weekday = weekdayKeyInTz(newStart, settings.timezone);
  if (!settings.working_hours[weekday] || settings.working_hours[weekday].length === 0) {
    return { error: "We're closed that day. Pick another." };
  }

  const dayStart = new Date(newStart);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 2);

  const [{ data: bookings }, { data: blocked }] = await Promise.all([
    service
      .from("bookings")
      .select("start_at, end_at")
      .eq("car_id", booking.car_id)
      .eq("status", "confirmed")
      .neq("id", booking.id)
      .gte("start_at", dayStart.toISOString())
      .lte("start_at", dayEnd.toISOString()),
    service
      .from("blocked_slots")
      .select("start_at, end_at")
      .gte("end_at", dayStart.toISOString())
      .lte("start_at", dayEnd.toISOString()),
  ]);

  const available = computeAvailableSlots({
    localDate,
    settings,
    bookings: bookings ?? [],
    blockedSlots: blocked ?? [],
  });
  if (!available.some((s) => s.startUtc === newStart.toISOString())) {
    return { error: "That slot was just taken. Pick another." };
  }

  const oldStart = booking.start_at;
  const newEnd = addMinutes(newStart, settings.slot_duration_minutes).toISOString();

  const { error: updateError } = await service
    .from("bookings")
    .update({ start_at: newStart.toISOString(), end_at: newEnd, reminder_offsets_sent: [] })
    .eq("id", booking.id);

  if (updateError) {
    if (updateError.code === "23505") {
      return { error: "Someone else just took that slot. Please pick another." };
    }
    return { error: updateError.message };
  }

  await sendRescheduleEmail(booking.id, oldStart, token).catch((err) => {
    console.error("Failed to send reschedule email", err);
  });

  revalidatePath(`/booking/${id}`);
  revalidatePath("/admin/bookings");
  redirect(`/booking/${id}?token=${token}`);
}
