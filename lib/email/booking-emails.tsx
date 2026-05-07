import "server-only";
import BookingConfirmation from "@/emails/booking-confirmation";
import BookingCancellation from "@/emails/booking-cancellation";
import BookingReminder from "@/emails/booking-reminder";
import BookingReschedule from "@/emails/booking-reschedule";
import { buildIcs } from "@/lib/ics";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { formatDateTimeInTz } from "@/lib/tz";
import type { Booking, Car, Customer, Settings } from "@/lib/supabase/types";
import { sendBookingEmail } from "./send";
import { getEmailConfig } from "./config";

const TYPE_LABEL = { viewing: "Viewing", test_drive: "Test drive" } as const;

type FullContext = {
  booking: Booking;
  car: Car;
  customer: Customer;
  settings: Settings;
  manageToken: string;
};

async function loadContext(bookingId: string, manageToken: string): Promise<FullContext | null> {
  const service = createSupabaseServiceClient();
  const { data: bookingData } = await service
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  if (!bookingData) return null;
  const booking = bookingData as Booking;

  const [{ data: carData }, { data: customerData }, { data: settingsData }] = await Promise.all([
    service.from("cars").select("*").eq("id", booking.car_id).single(),
    service.from("customers").select("*").eq("id", booking.customer_id).single(),
    service.from("settings").select("*").eq("organization_id", booking.organization_id).single(),
  ]);

  return {
    booking,
    car: carData as Car,
    customer: customerData as Customer,
    settings: settingsData as Settings,
    manageToken,
  };
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function carHeadline(car: Car): string {
  return `${car.year} ${car.make} ${car.model}${car.variant ? ` ${car.variant}` : ""}`;
}

export async function sendConfirmationEmail(bookingId: string, manageToken: string) {
  const ctx = await loadContext(bookingId, manageToken);
  if (!ctx) return;
  const { booking, car, customer, settings } = ctx;

  const emailCfg = await getEmailConfig(booking.organization_id);
  if (!emailCfg.enabled) return;

  const startDate = new Date(booking.start_at);
  const endDate = new Date(booking.end_at);
  const whenLabel = formatDateTimeInTz(startDate, settings.timezone);
  const headline = carHeadline(car);
  const businessName = settings.business_name ?? "Car Booking";
  const manageUrl = `${siteUrl()}/booking/${booking.id}?token=${manageToken}`;
  const cancelUrl = `${siteUrl()}/booking/${booking.id}/cancel?token=${manageToken}`;

  const ics = buildIcs({
    uid: `${booking.id}@car-booking-crm`,
    startUtc: startDate,
    endUtc: endDate,
    summary: `${TYPE_LABEL[booking.type]} — ${headline}`,
    description: `${TYPE_LABEL[booking.type]} of the ${headline}.\n\nManage: ${manageUrl}\nReference: ${booking.reference}`,
    organiserName: businessName,
    organiserEmail: settings.contact_email ?? undefined,
    attendeeName: customer.name,
    attendeeEmail: customer.email,
    status: "CONFIRMED",
  });

  await sendBookingEmail({
    to: customer.email,
    from: emailCfg.from,
    subject: `Booking confirmed — ${headline} on ${whenLabel}`,
    template: "confirmation",
    bookingId: booking.id,
    react: BookingConfirmation({
      customerName: customer.name,
      carHeadline: headline,
      whenLabel,
      typeLabel: TYPE_LABEL[booking.type],
      reference: booking.reference,
      manageUrl,
      cancelUrl,
      businessName,
      contactPhone: settings.contact_phone,
    }),
    attachments: [
      { filename: "booking.ics", content: ics, contentType: "text/calendar; charset=utf-8" },
    ],
  });
}

export async function sendCancellationEmail(bookingId: string) {
  const service = createSupabaseServiceClient();
  const { data: bookingData } = await service
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  if (!bookingData) return;
  const booking = bookingData as Booking;

  const [{ data: carData }, { data: customerData }, { data: settingsData }] = await Promise.all([
    service.from("cars").select("*").eq("id", booking.car_id).single(),
    service.from("customers").select("*").eq("id", booking.customer_id).single(),
    service.from("settings").select("*").eq("organization_id", booking.organization_id).single(),
  ]);

  const car = carData as Car;
  const customer = customerData as Customer;
  const settings = settingsData as Settings;
  const headline = carHeadline(car);
  const businessName = settings.business_name ?? "Car Booking";

  const emailCfg = await getEmailConfig(booking.organization_id);
  if (!emailCfg.enabled) return;

  await sendBookingEmail({
    to: customer.email,
    from: emailCfg.from,
    subject: `Booking cancelled — ${headline}`,
    template: "cancellation",
    bookingId: booking.id,
    react: BookingCancellation({
      customerName: customer.name,
      carHeadline: headline,
      whenLabel: formatDateTimeInTz(new Date(booking.start_at), settings.timezone),
      reference: booking.reference,
      rebookUrl: `${siteUrl()}/cars`,
      businessName,
    }),
  });
}

function offsetLabel(offsetHours: number): { subject: string; preview: string; heading: string } {
  if (offsetHours <= 24) {
    return { subject: "tomorrow", preview: "Tomorrow", heading: "See you tomorrow" };
  }
  const days = Math.round(offsetHours / 24);
  if (days >= 7) return { subject: "next week", preview: "Next week", heading: "See you next week" };
  return {
    subject: `in ${days} days`,
    preview: `In ${days} days`,
    heading: `See you in ${days} days`,
  };
}

export async function sendReminderEmail(
  bookingId: string,
  manageToken: string,
  offsetHours = 24,
) {
  const ctx = await loadContext(bookingId, manageToken);
  if (!ctx) return;
  const { booking, car, customer, settings } = ctx;

  const emailCfg = await getEmailConfig(booking.organization_id);
  if (!emailCfg.enabled) return;

  const whenLabel = formatDateTimeInTz(new Date(booking.start_at), settings.timezone);
  const headline = carHeadline(car);
  const businessName = settings.business_name ?? "Car Booking";
  const manageUrl = `${siteUrl()}/booking/${booking.id}?token=${manageToken}`;
  const cancelUrl = `${siteUrl()}/booking/${booking.id}/cancel?token=${manageToken}`;
  const { subject, preview, heading } = offsetLabel(offsetHours);

  await sendBookingEmail({
    to: customer.email,
    from: emailCfg.from,
    subject: `Reminder — ${headline} ${subject} at ${whenLabel}`,
    template: "reminder",
    bookingId: booking.id,
    react: BookingReminder({
      customerName: customer.name,
      carHeadline: headline,
      whenLabel,
      typeLabel: TYPE_LABEL[booking.type],
      reference: booking.reference,
      manageUrl,
      cancelUrl,
      businessName,
      contactPhone: settings.contact_phone,
      previewLabel: preview,
      headingLabel: heading,
    }),
  });
}

export async function sendRescheduleEmail(
  bookingId: string,
  oldStartUtc: string,
  manageToken: string,
) {
  const ctx = await loadContext(bookingId, manageToken);
  if (!ctx) return;
  const { booking, car, customer, settings } = ctx;

  const emailCfg = await getEmailConfig(booking.organization_id);
  if (!emailCfg.enabled) return;

  const startDate = new Date(booking.start_at);
  const endDate = new Date(booking.end_at);
  const newWhenLabel = formatDateTimeInTz(startDate, settings.timezone);
  const oldWhenLabel = formatDateTimeInTz(new Date(oldStartUtc), settings.timezone);
  const headline = carHeadline(car);
  const businessName = settings.business_name ?? "Car Booking";
  const manageUrl = `${siteUrl()}/booking/${booking.id}?token=${manageToken}`;
  const cancelUrl = `${siteUrl()}/booking/${booking.id}/cancel?token=${manageToken}`;

  const ics = buildIcs({
    uid: `${booking.id}@car-booking-crm`,
    startUtc: startDate,
    endUtc: endDate,
    summary: `${TYPE_LABEL[booking.type]} — ${headline}`,
    description: `Rescheduled ${TYPE_LABEL[booking.type].toLowerCase()} of the ${headline}.\n\nManage: ${manageUrl}\nReference: ${booking.reference}`,
    organiserName: businessName,
    organiserEmail: settings.contact_email ?? undefined,
    attendeeName: customer.name,
    attendeeEmail: customer.email,
    status: "CONFIRMED",
  });

  await sendBookingEmail({
    to: customer.email,
    from: emailCfg.from,
    subject: `Rescheduled — ${headline} now on ${newWhenLabel}`,
    template: "reschedule",
    bookingId: booking.id,
    react: BookingReschedule({
      customerName: customer.name,
      carHeadline: headline,
      oldWhenLabel,
      newWhenLabel,
      typeLabel: TYPE_LABEL[booking.type],
      reference: booking.reference,
      manageUrl,
      cancelUrl,
      businessName,
    }),
    attachments: [
      { filename: "booking.ics", content: ics, contentType: "text/calendar; charset=utf-8" },
    ],
  });
}
