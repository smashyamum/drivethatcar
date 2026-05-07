"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getActiveMembership, getActiveOrg, getActiveOrgId } from "@/lib/tenant";
import { isValidSlug, RESERVED_ORG_SLUGS } from "@/lib/slug";
import { REMINDER_OFFSET_PRESETS, WEEKDAYS } from "@/lib/supabase/types";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const WindowSchema = z
  .object({ start: z.string().regex(HHMM), end: z.string().regex(HHMM) })
  .refine((w) => w.start < w.end, { message: "End must be after start" });

const WorkingHoursSchema = z.object({
  mon: z.array(WindowSchema),
  tue: z.array(WindowSchema),
  wed: z.array(WindowSchema),
  thu: z.array(WindowSchema),
  fri: z.array(WindowSchema),
  sat: z.array(WindowSchema),
  sun: z.array(WindowSchema),
});

const SettingsSchema = z.object({
  business_name: z.string().trim().nullable(),
  contact_email: z.union([z.string().email(), z.literal("")]).nullable(),
  contact_phone: z.string().trim().nullable(),
  timezone: z.string().min(1),
  slot_duration_minutes: z.coerce.number().int().min(15).max(480),
  buffer_minutes: z.coerce.number().int().min(0).max(480),
  resend_from_email: z.union([z.string().email(), z.literal("")]).nullable(),
  working_hours: WorkingHoursSchema,
  reminder_offsets_hours: z.array(z.number().int().positive().max(720)).max(6),
});

export type SettingsState = { error?: string; ok?: boolean };

export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const orgId = await getActiveOrgId();

  // Parse working_hours from individual form fields:
  // for each weekday: open=on/off, start=HH:mm, end=HH:mm
  const workingHours: Record<string, Array<{ start: string; end: string }>> = {};
  for (const day of WEEKDAYS) {
    const open = formData.get(`${day}_open`) === "on";
    const start = (formData.get(`${day}_start`) as string) ?? "09:00";
    const end = (formData.get(`${day}_end`) as string) ?? "19:00";
    workingHours[day] = open ? [{ start, end }] : [];
  }

  const reminderOffsets = REMINDER_OFFSET_PRESETS.map((p) => p.hours)
    .filter((h) => formData.get(`reminder_${h}`) === "on")
    .sort((a, b) => b - a);

  const parsed = SettingsSchema.safeParse({
    business_name: (formData.get("business_name") as string)?.trim() || null,
    contact_email: (formData.get("contact_email") as string)?.trim() || null,
    contact_phone: (formData.get("contact_phone") as string)?.trim() || null,
    timezone: formData.get("timezone"),
    slot_duration_minutes: formData.get("slot_duration_minutes"),
    buffer_minutes: formData.get("buffer_minutes"),
    resend_from_email: (formData.get("resend_from_email") as string)?.trim() || null,
    working_hours: workingHours,
    reminder_offsets_hours: reminderOffsets,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  }

  const { error } = await supabase
    .from("settings")
    .update(parsed.data)
    .eq("organization_id", orgId);

  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Custom public-page slug — Pro-only.
// ---------------------------------------------------------------------------

export type SlugState = { error?: string; ok?: boolean };

export async function updateOrgSlug(
  _prev: SlugState,
  formData: FormData,
): Promise<SlugState> {
  const { role } = await getActiveMembership();
  if (role !== "owner" && role !== "admin") {
    return { error: "Only owners or admins can change the public address." };
  }

  const org = await getActiveOrg();
  if (!org.limits.customSlug) {
    return { error: "Changing your public address is a Pro feature." };
  }

  const raw = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();

  if (!isValidSlug(raw)) {
    return {
      error:
        "Use 3–120 characters: lowercase letters, numbers and dashes only (e.g. my-motors).",
    };
  }
  if (RESERVED_ORG_SLUGS.has(raw)) {
    return { error: "That address is reserved — pick something else." };
  }

  // Service client because RLS on organizations restricts writes; we've
  // already validated role + plan above.
  const service = createSupabaseServiceClient();
  const { data: clash } = await service
    .from("organizations")
    .select("id")
    .eq("slug", raw)
    .neq("id", org.id)
    .maybeSingle();
  if (clash) {
    return { error: "That address is already taken — try another." };
  }

  const { error } = await service
    .from("organizations")
    .update({ slug: raw })
    .eq("id", org.id);
  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}
