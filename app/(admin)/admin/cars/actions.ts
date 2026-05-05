"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  const { price_pounds, slug: providedSlug, ...rest } = parsed.data;

  let slug: string;
  if (providedSlug && providedSlug.length > 0) {
    if (!isValidSlug(providedSlug)) return { error: "Invalid slug format." };
    const { data: existing } = await supabase.from("cars").select("id").eq("slug", providedSlug).maybeSingle();
    if (existing) return { fieldErrors: { slug: "Slug already in use." } };
    slug = providedSlug;
  } else {
    slug = await generateUniqueSlug(rest, async (candidate) => {
      const { data } = await supabase.from("cars").select("id").eq("slug", candidate).maybeSingle();
      return !!data;
    });
  }

  const { data: created, error } = await supabase
    .from("cars")
    .insert({
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

  const update = {
    ...rest,
    price_pence: Math.round(price_pounds * 100),
    ...(providedSlug && providedSlug.length > 0 ? { slug: providedSlug } : {}),
  };

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

export async function deleteCar(id: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { count: bookingCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("car_id", id);

  if ((bookingCount ?? 0) > 0) {
    redirect(`/admin/cars/${id}?error=has_bookings`);
  }

  const { error, count } = await supabase
    .from("cars")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    redirect(`/admin/cars/${id}?error=${encodeURIComponent(error.message)}`);
  }
  if ((count ?? 0) === 0) {
    // No row matched — either gone already or RLS blocked it silently.
    redirect(`/admin/cars/${id}?error=no_rows_affected`);
  }

  revalidatePath("/admin/cars");
  revalidatePath("/cars");
  redirect("/admin/cars?deleted=1");
}
