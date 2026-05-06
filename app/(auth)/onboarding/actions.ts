"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  generateUniqueOrgSlug,
  generateUniqueSlug,
  isValidSlug,
  RESERVED_ORG_SLUGS,
} from "@/lib/slug";
import { WEEKDAYS, type Weekday } from "@/lib/supabase/types";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const CarSchema = z.object({
  car_make: z.string().trim().min(1, "Make is required").max(80),
  car_model: z.string().trim().min(1, "Model is required").max(80),
  car_year: z.coerce.number().int().min(1900).max(2100),
  car_price_aed: z.coerce.number().nonnegative(),
  car_mileage: z.string().trim().transform((v) => (v.length === 0 ? null : Number(v))).pipe(z.number().int().nonnegative().nullable()),
  car_colour: z.string().trim().transform((v) => (v.length === 0 ? null : v)).nullable(),
  car_transmission: z.string().trim().transform((v) => (v.length === 0 ? null : v)).nullable(),
  car_fuel_type: z.string().trim().transform((v) => (v.length === 0 ? null : v)).nullable(),
});

const OnboardingSchema = z.object({
  business_name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(3).max(60),
  timezone: z.string().trim().min(1),
  contact_phone: z.string().trim().min(4).max(40),
  open_days: z.array(z.enum(WEEKDAYS as unknown as [Weekday, ...Weekday[]])).min(1),
  open_start: z.string().regex(HHMM),
  open_end: z.string().regex(HHMM),
});

export type OnboardingState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const TRIAL_DAYS = 7;

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const openDays = formData.getAll("open_days").filter((v): v is string => typeof v === "string");

  const parsed = OnboardingSchema.safeParse({
    business_name: formData.get("business_name"),
    slug: formData.get("slug"),
    timezone: formData.get("timezone") || "Asia/Dubai",
    contact_phone: formData.get("contact_phone"),
    open_days: openDays,
    open_start: formData.get("open_start") || "09:00",
    open_end: formData.get("open_end") || "19:00",
  });

  const carParsed = CarSchema.safeParse({
    car_make: formData.get("car_make") ?? "",
    car_model: formData.get("car_model") ?? "",
    car_year: formData.get("car_year") ?? new Date().getFullYear(),
    car_price_aed: formData.get("car_price_aed") ?? "0",
    car_mileage: formData.get("car_mileage") ?? "",
    car_colour: formData.get("car_colour") ?? "",
    car_transmission: formData.get("car_transmission") ?? "",
    car_fuel_type: formData.get("car_fuel_type") ?? "",
  });

  if (!carParsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of carParsed.error.issues) {
      const path = issue.path.join(".");
      if (!fe[path]) fe[path] = issue.message;
    }
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (!fe[path]) fe[path] = issue.message;
      }
    }
    return { fieldErrors: fe };
  }

  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fe[path]) fe[path] = issue.message;
    }
    return { fieldErrors: fe };
  }

  const data = parsed.data;

  if (data.open_start >= data.open_end) {
    return { fieldErrors: { open_end: "End time must be after start time" } };
  }

  if (!isValidSlug(data.slug)) {
    return {
      fieldErrors: {
        slug: "Use lowercase letters, numbers and hyphens only (3+ chars).",
      },
    };
  }

  if (RESERVED_ORG_SLUGS.has(data.slug)) {
    return { fieldErrors: { slug: "This URL is reserved — please pick another." } };
  }

  // Already a member of an org? Don't double-create.
  const { data: existingMembership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (existingMembership) redirect("/admin");

  // Slug uniqueness — fall back to auto-generation on collision rather than
  // erroring, since the user might be in the middle of typing.
  let slug = data.slug;
  const { data: slugTaken } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (slugTaken) {
    slug = await generateUniqueOrgSlug(data.business_name, async (candidate) => {
      const { data: row } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", candidate)
        .maybeSingle();
      return !!row;
    });
  }

  // Build working_hours: single window [open_start, open_end] on chosen days.
  const window = { start: data.open_start, end: data.open_end };
  const workingHours = Object.fromEntries(
    WEEKDAYS.map((d) => [d, data.open_days.includes(d) ? [window] : []]),
  );

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Use the service client so we sidestep RLS bootstrap chicken-and-egg
  // (the user has no membership yet, so RLS would block them inserting
  // into organizations / memberships / settings).
  const service = createSupabaseServiceClient();

  const { data: org, error: orgErr } = await service
    .from("organizations")
    .insert({
      slug,
      name: data.business_name,
      plan: "trial",
      trial_ends_at: trialEndsAt,
    })
    .select("id")
    .single();
  if (orgErr || !org) {
    return { error: orgErr?.message ?? "Could not create organisation." };
  }

  const { error: memErr } = await service.from("memberships").insert({
    organization_id: org.id,
    user_id: user.id,
    role: "owner",
  });
  if (memErr) {
    return { error: memErr.message };
  }

  const { error: setErr } = await service.from("settings").insert({
    organization_id: org.id,
    business_name: data.business_name,
    contact_email: user.email ?? null,
    contact_phone: data.contact_phone,
    timezone: data.timezone,
    slot_duration_minutes: 60,
    buffer_minutes: 15,
    working_hours: workingHours,
    reminder_offsets_hours: [24, 48],
  });
  if (setErr) {
    return { error: setErr.message };
  }

  // Insert the first car using the service client (user has no RLS membership cookie yet).
  const car = carParsed.data;
  const carSlug = await generateUniqueSlug(
    { year: car.car_year, make: car.car_make, model: car.car_model },
    async (candidate) => {
      const { data: row } = await service
        .from("cars")
        .select("id")
        .eq("organization_id", org.id)
        .eq("slug", candidate)
        .maybeSingle();
      return !!row;
    },
  );

  await service.from("cars").insert({
    organization_id: org.id,
    slug: carSlug,
    make: car.car_make,
    model: car.car_model,
    year: car.car_year,
    price_pence: Math.round(car.car_price_aed * 100),
    mileage: car.car_mileage,
    colour: car.car_colour,
    transmission: car.car_transmission,
    fuel_type: car.car_fuel_type,
    status: "available",
  });

  redirect("/onboarding/choose-plan");
}
