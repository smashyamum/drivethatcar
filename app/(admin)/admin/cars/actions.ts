"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveOrg, getActiveOrgId } from "@/lib/tenant";
import { generateUniqueSlug, isValidSlug } from "@/lib/slug";
import { sendCancellationEmail } from "@/lib/email/booking-emails";
import type { CarStatus } from "@/lib/supabase/types";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v))
  .nullable()
  .optional();

const optionalEnum = <T extends [string, ...string[]]>(values: T) =>
  z
    .string()
    .trim()
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional()
    .pipe(z.enum(values).nullable().optional());

const optionalInt = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : Number(v)))
  .pipe(z.number().int().nonnegative().nullable());

const CarInputSchema = z.object({
  make: z.string().trim().min(1, "Make is required"),
  model: z.string().trim().min(1, "Model is required"),
  year: z.coerce.number().int().min(1900).max(2100),
  variant: optionalText,
  mileage: optionalInt,
  price_pounds: z.coerce.number().nonnegative(),
  colour: optionalText,
  transmission: optionalEnum(["manual", "automatic", "semi_auto"]),
  fuel_type: optionalEnum(["petrol", "diesel", "hybrid", "phev", "electric"]),
  body_type: optionalEnum([
    "hatchback",
    "saloon",
    "estate",
    "suv",
    "coupe",
    "convertible",
    "mpv",
    "pickup",
  ]),
  registration: optionalText,
  description: optionalText,
  status: z.enum(["available", "sold", "hidden"]).default("available"),
  slug: z.string().trim().optional(),
});

export type CarFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function parseFormData(formData: FormData) {
  return CarInputSchema.safeParse({
    make: formData.get("make"),
    model: formData.get("model"),
    year: formData.get("year"),
    variant: formData.get("variant") ?? "",
    mileage: formData.get("mileage") ?? "",
    price_pounds: formData.get("price_pounds"),
    colour: formData.get("colour") ?? "",
    transmission: formData.get("transmission") ?? "",
    fuel_type: formData.get("fuel_type") ?? "",
    body_type: formData.get("body_type") ?? "",
    registration: formData.get("registration") ?? "",
    description: formData.get("description") ?? "",
    status: (formData.get("status") as CarStatus) ?? "available",
    slug: formData.get("slug") ?? undefined,
  });
}

function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (path && !out[path]) out[path] = issue.message;
  }
  return out;
}

export async function createCar(_prev: CarFormState, formData: FormData): Promise<CarFormState> {
  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { id: orgId, limits, plan } = await getActiveOrg();

  // Plan-level cap on the number of cars an org can list.
  const { count: existingCarCount } = await supabase
    .from("cars")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  if ((existingCarCount ?? 0) >= limits.cars) {
    const planLabel = plan === "free" ? "Free" : "Starter";
    return {
      error: `${planLabel} plan is limited to ${limits.cars} cars. Upgrade your plan to add more.`,
    };
  }
  const { price_pounds, slug: providedSlug, ...rest } = parsed.data;

  let slug: string;
  if (providedSlug && providedSlug.length > 0) {
    if (!isValidSlug(providedSlug)) return { error: "Invalid slug format." };
    const { data: existing } = await supabase
      .from("cars")
      .select("id")
      .eq("organization_id", orgId)
      .eq("slug", providedSlug)
      .maybeSingle();
    if (existing) return { fieldErrors: { slug: "Slug already in use." } };
    slug = providedSlug;
  } else {
    slug = await generateUniqueSlug(rest, async (candidate) => {
      const { data } = await supabase
        .from("cars")
        .select("id")
        .eq("organization_id", orgId)
        .eq("slug", candidate)
        .maybeSingle();
      return !!data;
    });
  }

  const { data: created, error } = await supabase
    .from("cars")
    .insert({
      organization_id: orgId,
      ...rest,
      slug,
      price_pence: Math.round(price_pounds * 100),
    })
    .select("id")
    .single();

  if (error || !created) {
    return { error: error?.message ?? "Could not create car." };
  }

  revalidatePath("/admin/cars");
  revalidatePath("/cars");
  redirect(`/admin/cars/${created.id}`);
}

export async function updateCar(
  id: string,
  _prev: CarFormState,
  formData: FormData,
): Promise<CarFormState> {
  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { price_pounds, slug: providedSlug, ...rest } = parsed.data;

  if (providedSlug !== undefined && providedSlug.length > 0) {
    if (!isValidSlug(providedSlug)) return { error: "Invalid slug format." };
    const { data: existing } = await supabase
      .from("cars")
      .select("id")
      .eq("slug", providedSlug)
      .neq("id", id)
      .maybeSingle();
    if (existing) return { fieldErrors: { slug: "Slug already in use." } };
  }

  // Detect status transition into 'sold' so we can cascade-cancel
  // future bookings on the same car after the update lands.
  const { data: previous } = await supabase
    .from("cars")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  const wasNotSold = previous?.status !== "sold";
  const isBecomingSold = rest.status === "sold" && wasNotSold;

  const update: Record<string, unknown> = {
    ...rest,
    price_pence: Math.round(price_pounds * 100),
    ...(providedSlug && providedSlug.length > 0 ? { slug: providedSlug } : {}),
  };

  // Stamp sold_at exactly when status transitions into 'sold' (and clear it
  // if a previously-sold car gets relisted). Analytics needs the precise
  // moment to bucket sales by date range.
  if (isBecomingSold) {
    update.sold_at = new Date().toISOString();
  } else if (previous?.status === "sold" && rest.status !== "sold") {
    update.sold_at = null;
  }

  const { error } = await supabase.from("cars").update(update).eq("id", id);
  if (error) return { error: error.message };

  if (isBecomingSold) {
    const nowIso = new Date().toISOString();
    const { data: futureBookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("car_id", id)
      .eq("status", "confirmed")
      .gt("start_at", nowIso);
    const ids = (futureBookings ?? []).map((b) => (b as { id: string }).id);

    if (ids.length > 0) {
      await supabase
        .from("bookings")
        .update({
          status: "cancelled",
          cancelled_at: nowIso,
          cancelled_by: "admin",
        })
        .in("id", ids);

      // Fire-and-forget emails — don't block the action on Resend.
      await Promise.all(
        ids.map((bid) =>
          sendCancellationEmail(bid).catch((err) => {
            console.error(`Failed to send cancellation email for ${bid}`, err);
          }),
        ),
      );
      revalidatePath("/admin/bookings");
    }
  }

  revalidatePath("/admin/cars");
  revalidatePath(`/admin/cars/${id}`);
  revalidatePath("/cars");
  return {};
}

/**
 * Bulk-delete cars. Mirrors deleteLeads — the FK is "on delete restrict"
 * so we drop attached bookings first, but for any *future confirmed*
 * booking we fire a cancellation email before the row goes away (so the
 * customer hears about it from the dealer rather than just losing their
 * confirmation link).
 */
export async function deleteCars(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rawIds = formData.getAll("ids").filter((v): v is string => typeof v === "string");
  const ids = Array.from(new Set(rawIds)).filter((s) => s.length > 0);

  if (ids.length === 0 || ids.length > 200) {
    redirect("/admin/cars?error=none_selected");
  }

  const nowIso = new Date().toISOString();
  const { data: futureConfirmed } = await supabase
    .from("bookings")
    .select("id")
    .in("car_id", ids)
    .eq("status", "confirmed")
    .gt("start_at", nowIso);
  const futureIds = (futureConfirmed ?? []).map((b) => (b as { id: string }).id);

  if (futureIds.length > 0) {
    await Promise.all(
      futureIds.map((bid) =>
        sendCancellationEmail(bid).catch((err) => {
          console.error(`Failed to send cancellation email for ${bid}`, err);
        }),
      ),
    );
  }

  const { error: bookingsErr, count: bookingsDeleted } = await supabase
    .from("bookings")
    .delete({ count: "exact" })
    .in("car_id", ids);
  if (bookingsErr) {
    redirect(`/admin/cars?error=${encodeURIComponent(bookingsErr.message)}`);
  }

  const { error, count } = await supabase
    .from("cars")
    .delete({ count: "exact" })
    .in("id", ids);
  if (error) {
    redirect(`/admin/cars?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/cars");
  revalidatePath("/admin/bookings");
  revalidatePath("/cars");

  const params = new URLSearchParams();
  params.set("deleted", String(count ?? 0));
  if ((bookingsDeleted ?? 0) > 0) params.set("bookings", String(bookingsDeleted));
  redirect(`/admin/cars?${params.toString()}`);
}

export async function deleteCar(id: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Cascade through bookings — FK is on delete restrict. We also send a
  // cancellation email for any *future confirmed* booking that hasn't already
  // been cancelled (e.g. when admin clicks Delete without first marking
  // the car sold). Past/cancelled bookings are dropped silently.
  const nowIso = new Date().toISOString();
  const { data: futureConfirmed } = await supabase
    .from("bookings")
    .select("id")
    .eq("car_id", id)
    .eq("status", "confirmed")
    .gt("start_at", nowIso);
  const futureIds = (futureConfirmed ?? []).map((b) => (b as { id: string }).id);

  // Send emails BEFORE the row goes away (the email helper joins customer/car).
  if (futureIds.length > 0) {
    await Promise.all(
      futureIds.map((bid) =>
        sendCancellationEmail(bid).catch((err) => {
          console.error(`Failed to send cancellation email for ${bid}`, err);
        }),
      ),
    );
  }

  const { error: bookingsErr, count: bookingsDeleted } = await supabase
    .from("bookings")
    .delete({ count: "exact" })
    .eq("car_id", id);
  if (bookingsErr) {
    redirect(`/admin/cars/${id}?error=${encodeURIComponent(bookingsErr.message)}`);
  }

  const { error, count } = await supabase
    .from("cars")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    redirect(`/admin/cars/${id}?error=${encodeURIComponent(error.message)}`);
  }
  if ((count ?? 0) === 0) {
    redirect(`/admin/cars/${id}?error=no_rows_affected`);
  }

  revalidatePath("/admin/cars");
  revalidatePath("/admin/bookings");
  revalidatePath("/cars");
  const params = new URLSearchParams({ deleted: "1" });
  if ((bookingsDeleted ?? 0) > 0) params.set("bookings", String(bookingsDeleted));
  redirect(`/admin/cars?${params}`);
}
