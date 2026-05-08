"use server";

import { redirect } from "next/navigation";
import { addMinutes } from "date-fns";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendConfirmationEmail } from "@/lib/email/booking-emails";
import { generateBookingReference } from "@/lib/reference";
import { generateManageToken } from "@/lib/tokens";
import { getActiveMembership } from "@/lib/tenant";
import type { Car, Settings } from "@/lib/supabase/types";

// Loose phone regex — admins know what they're entering, no need to be strict.
const PhoneIsh = /^\+?[\d\s().-]{4,30}$/;

const BaseSchema = z.object({
  carId: z.string().uuid("Pick a car"),
  type: z.enum(["viewing", "test_drive"]),
  // Local datetime from <input type="datetime-local"> (e.g. "2026-05-09T14:30")
  startLocal: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/,
      "Pick a valid date and time",
    ),
  customerMode: z.enum(["existing", "new"]),
});

const ExistingCustomer = z.object({
  customerId: z.string().uuid("Pick a customer"),
});

const NewCustomer = z.object({
  name: z.string().trim().min(2, "Customer name is required"),
  phone: z.string().trim().regex(PhoneIsh, "Enter a valid phone number"),
  email: z
    .union([z.string().trim().email("Enter a valid email"), z.literal("")])
    .optional()
    .transform((v) => (v && v.length > 0 ? v.toLowerCase() : null)),
});

export type CreateBookingState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createAdminBooking(
  _prev: CreateBookingState,
  formData: FormData,
): Promise<CreateBookingState> {
  const baseParsed = BaseSchema.safeParse({
    carId: formData.get("carId"),
    type: formData.get("type"),
    startLocal: formData.get("startLocal"),
    customerMode: formData.get("customerMode"),
  });
  if (!baseParsed.success) {
    return { fieldErrors: zodFieldErrors(baseParsed.error) };
  }
  const base = baseParsed.data;

  let customerId: string;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { orgId } = await getActiveMembership();
  const service = createSupabaseServiceClient();

  if (base.customerMode === "existing") {
    const parsed = ExistingCustomer.safeParse({
      customerId: formData.get("customerId"),
    });
    if (!parsed.success) {
      return { fieldErrors: zodFieldErrors(parsed.error) };
    }
    // Verify the customer is in the same org (RLS would also block, but be
    // explicit for clearer errors).
    const { data: customer } = await service
      .from("customers")
      .select("id, organization_id")
      .eq("id", parsed.data.customerId)
      .maybeSingle();
    if (!customer || customer.organization_id !== orgId) {
      return { error: "That customer doesn't exist." };
    }
    customerId = customer.id as string;
  } else {
    const parsed = NewCustomer.safeParse({
      name: formData.get("name"),
      phone: formData.get("phone"),
      email: formData.get("email"),
    });
    if (!parsed.success) {
      return { fieldErrors: zodFieldErrors(parsed.error) };
    }

    // Dedupe on (org, phone, email) — same shape as the public booking flow
    // so a returning customer doesn't get a duplicate row.
    let dedupeQuery = service
      .from("customers")
      .select("id")
      .eq("organization_id", orgId)
      .eq("phone", parsed.data.phone);
    dedupeQuery = parsed.data.email
      ? dedupeQuery.eq("email", parsed.data.email)
      : dedupeQuery.is("email", null);
    const { data: existing } = await dedupeQuery.maybeSingle();

    if (existing) {
      customerId = existing.id as string;
      await service
        .from("customers")
        .update({ name: parsed.data.name })
        .eq("id", existing.id as string);
    } else {
      const { data: created, error: createErr } = await service
        .from("customers")
        .insert({
          organization_id: orgId,
          assigned_to: user.id,
          name: parsed.data.name,
          phone: parsed.data.phone,
          email: parsed.data.email ?? "",
          lead_status: "new",
        })
        .select("id")
        .single();
      if (createErr || !created) {
        return { error: createErr?.message ?? "Could not create the lead." };
      }
      customerId = created.id as string;
    }
  }

  // Convert the local datetime to UTC. We treat the input as the org's
  // configured timezone; matches what the public flow does for slot picks.
  const { data: settingsRow } = await service
    .from("settings")
    .select("*")
    .eq("organization_id", orgId)
    .single();
  if (!settingsRow) return { error: "Settings missing — contact support." };
  const settings = settingsRow as Settings;

  const startDate = parseLocalAsTz(base.startLocal, settings.timezone);
  if (!startDate || Number.isNaN(startDate.getTime())) {
    return { fieldErrors: { startLocal: "Pick a valid date and time" } };
  }
  if (startDate.getTime() <= Date.now()) {
    return { fieldErrors: { startLocal: "Pick a time in the future" } };
  }

  // Conflict check on the same car — must not overlap an existing confirmed
  // booking. We trust the partial unique index as the final guard.
  const { data: carRow } = await service
    .from("cars")
    .select("*")
    .eq("id", base.carId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!carRow) return { error: "Car not found." };
  const car = carRow as Car;
  if (car.status !== "available") {
    return { error: "That car isn't available — pick another." };
  }

  const endAt = addMinutes(startDate, settings.slot_duration_minutes);
  const { data: conflicts } = await service
    .from("bookings")
    .select("id, start_at, end_at")
    .eq("car_id", base.carId)
    .eq("status", "confirmed")
    .gte("end_at", startDate.toISOString())
    .lte("start_at", endAt.toISOString());
  if ((conflicts ?? []).length > 0) {
    return {
      fieldErrors: {
        startLocal:
          "There's already a confirmed booking on this car at that time.",
      },
    };
  }

  const { token, hash } = generateManageToken();
  const reference = generateBookingReference();

  const { data: bookingRow, error: bookingErr } = await service
    .from("bookings")
    .insert({
      organization_id: orgId,
      assigned_to: user.id,
      reference,
      car_id: base.carId,
      customer_id: customerId,
      type: base.type,
      start_at: startDate.toISOString(),
      end_at: endAt.toISOString(),
      status: "confirmed",
      manage_token_hash: hash,
      manage_token: token,
    })
    .select("id")
    .single();

  if (bookingErr || !bookingRow) {
    if (bookingErr?.code === "23505") {
      return {
        fieldErrors: {
          startLocal: "Another confirmed booking just took that slot.",
        },
      };
    }
    return { error: bookingErr?.message ?? "Could not create the booking." };
  }

  // Fire-and-forget confirmation email — don't block the redirect.
  await sendConfirmationEmail(bookingRow.id as string, token).catch((err) => {
    console.error("Failed to send confirmation email", err);
  });

  redirect(`/admin/bookings/${bookingRow.id}`);
}

function zodFieldErrors(err: z.ZodError): Record<string, string> {
  const fe: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join(".");
    if (!fe[path]) fe[path] = issue.message;
  }
  return fe;
}

/**
 * Parses "YYYY-MM-DDTHH:mm" treating the wall-clock time as belonging to
 * the given IANA timezone. Returns the corresponding UTC Date.
 *
 * We do this without pulling in date-fns-tz: build a UTC date from the
 * components, then use Intl to compute the offset for that wall-clock time
 * in the target zone, then subtract.
 */
function parseLocalAsTz(local: string, timeZone: string): Date | null {
  const m = local.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss] = m;
  // Naive UTC build of the wall-clock components.
  const naiveUtc = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(hh),
    Number(mm),
    Number(ss ?? "0"),
  );

  // Offset (in minutes) between the target zone and UTC at that instant.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(naiveUtc));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const projected = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  const offsetMs = projected - naiveUtc;
  return new Date(naiveUtc - offsetMs);
}
