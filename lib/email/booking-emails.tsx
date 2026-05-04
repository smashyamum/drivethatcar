import "server-only";
import BookingConfirmation from "@/emails/booking-confirmation";
import BookingCancellation from "@/emails/booking-cancellation";
import BookingReschedule from "@/emails/booking-reschedule";
import { buildIcs } from "@/lib/ics";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { formatDateTimeInTz } from "@/lib/tz";
import type { Booking, Car, Customer, Settings } from "@/lib/supabase/types";
import { DEFAULT_SENDER, sendBookingEmail } from "./send";

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
    service.from("settings").select("*").eq("id", 1).single(),
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

function senderFor(settings: Settings, businessName: string): string {
  if (settings.resend_from_email) {
    return `${businessName} <${settings.resend_from_email}>`;
  }
  return DEFAULT_SENDER;
}

function carHeadline(car: Car): string {
  return `${car.year} ${car.make} ${car.model}${car.variant ? ` ${car.variant}` : ""}`;
}

export async function sendConfirmationEmail(bookingId: string, manageToken: string) {
  const ctx = await loadContext(bookingId, manageToken);
  if (!ctx) return;
  const { booking, car, customer, settings } = ctx;

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
    from: senderFor(settings, businessName),
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
    service.from("settings").select("*").eq("id", 1).single(),
  ]);

  const car = carData as Car;
  const customer = customerData as Customer;
  const settings = settingsData as Settings;
  const headline = carHeadline(car);
  const businessName = settings.business_name ?? "Car Booking";

  await sendBookingEmail({
    to: customer.email,
    from: senderFor(settings, businessName),
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

export async function sendRescheduleEmail(
  bookingId: string,
  oldStartUtc: string,
  manageToken: string,
) {
  const ctx = await loadContext(bookingId, manageToken);
  if (!ctx) return;
  const { booking, car, customer, settings } = ctx;

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
    from: senderFor(settings, businessName),
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
