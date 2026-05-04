"use server";

import { redirect } from "next/navigation";
import { addMinutes } from "date-fns";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { generateBookingReference } from "@/lib/reference";
import { generateManageToken } from "@/lib/tokens";
import { computeAvailableSlots } from "@/lib/slots/computeAvailableSlots";
import { sendConfirmationEmail } from "@/lib/email/booking-emails";
import { formatLocalDateString, weekdayKeyInTz } from "@/lib/tz";
import type { Car, Settings } from "@/lib/supabase/types";

const E164ish = /^\+?[\d\s().-]{7,20}$/;

const BookingInputSchema = z.object({
  carId: z.string().uuid(),
  type: z.enum(["viewing", "test_drive"]),
  startUtc: z.string().datetime(),
  name: z.string().trim().min(2, "Please enter your full name"),
  phone: z.string().trim().regex(E164ish, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email"),
});

export type BookingState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createBooking(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const parsed = BookingInputSchema.safeParse({
    carId: formData.get("carId"),
    type: formData.get("type"),
    startUtc: formData.get("startUtc"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fe[path]) fe[path] = issue.message;
    }
    return { fieldErrors: fe };
  }

  const { carId, type, startUtc, name, phone, email } = parsed.data;
  const service = createSupabaseServiceClient();

  // Load car + settings, validate
  const [{ data: carData }, { data: settingsData }] = await Promise.all([
    service.from("cars").select("*").eq("id", carId).maybeSingle(),
    service.from("settings").select("*").eq("id", 1).maybeSingle(),
  ]);

  if (!carData) return { error: "Car not found." };
  const car = carData as Car;
  if (car.status !== "available") return { error: "This car is no longer available." };
  if (!settingsData) return { error: "Settings missing — contact the dealer." };
  const settings = settingsData as Settings;

  const startDate = new Date(startUtc);
  if (Number.isNaN(startDate.getTime())) return { error: "Invalid time." };
  if (startDate <= new Date()) return { error: "That slot has passed." };

  // Re-validate slot is still available (race-condition belt+braces; final guard is the unique index)
  const localDate = formatLocalDateString(startDate);
  const weekday = weekdayKeyInTz(startDate, settings.timezone);
  if (!settings.working_hours[weekday] || settings.working_hours[weekday].length === 0) {
    return { error: "We're closed that day. Pick another." };
  }

  const dayStart = new Date(startDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 2);

  const [{ data: bookingsData }, { data: blockedData }] = await Promise.all([
    service
      .from("bookings")
      .select("start_at, end_at")
      .eq("car_id", carId)
      .eq("status", "confirmed")
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
    bookings: bookingsData ?? [],
    blockedSlots: blockedData ?? [],
  });
  if (!available.some((s) => s.startUtc === startDate.toISOString())) {
    return { error: "That slot was just taken. Pick another." };
  }

  // Upsert customer (dedupe on phone+email)
  const normalisedEmail = email.toLowerCase();
  const { data: existingCustomer } = await service
    .from("customers")
    .select("id")
    .eq("phone", phone)
    .eq("email", normalisedEmail)
    .maybeSingle();

  let customerId: string;
  if (existingCustomer) {
    customerId = existingCustomer.id;
    await service.from("customers").update({ name }).eq("id", existingCustomer.id);
  } else {
    const { data: created, error: customerError } = await service
      .from("customers")
      .insert({ name, phone, email: normalisedEmail })
      .select("id")
      .single();
    if (customerError || !created) {
      return { error: customerError?.message ?? "Could not save your details." };
    }
    customerId = created.id;
  }

  // Insert booking — partial unique index is the source of truth
  const { token, hash } = generateManageToken();
  const reference = generateBookingReference();
  const endAt = addMinutes(startDate, settings.slot_duration_minutes).toISOString();

  const { data: bookingRow, error: bookingError } = await service
    .from("bookings")
    .insert({
      reference,
      car_id: carId,
      customer_id: customerId,
      type,
      start_at: startDate.toISOString(),
      end_at: endAt,
      status: "confirmed",
      manage_token_hash: hash,
      manage_token: token,
    })
    .select("id")
    .single();

  if (bookingError || !bookingRow) {
    if (bookingError?.code === "23505") {
      return { error: "Someone else just took that slot. Please pick another." };
    }
    return { error: bookingError?.message ?? "Could not create booking." };
  }

  // Fire-and-forget: don't block the redirect on email delivery
  await sendConfirmationEmail(bookingRow.id, token).catch((err) => {
    console.error("Failed to send confirmation email", err);
  });

  redirect(`/booking/${bookingRow.id}?token=${token}`);
}
