"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/supabase/types";

const E164ish = /^\+?[\d\s().-]{7,20}$/;

const Schema = z.object({
  name: z.string().trim().min(2, "Enter a full name"),
  phone: z.string().trim().regex(E164ish, "Enter a valid phone"),
  email: z.string().trim().email("Enter a valid email"),
  lead_status: z.enum(LEAD_STATUSES as [LeadStatus, ...LeadStatus[]]).default("new"),
  lead_source: z.string().trim().optional(),
  interested_car_id: z.string().uuid().optional().nullable(),
  initial_note: z.string().trim().optional(),
});

export type NewLeadState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createLead(
  _prev: NewLeadState,
  formData: FormData,
): Promise<NewLeadState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const interestedRaw = (formData.get("interested_car_id") as string)?.trim() ?? "";
  const parsed = Schema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    lead_status: formData.get("lead_status") || "new",
    lead_source: (formData.get("lead_source") as string)?.trim() || undefined,
    interested_car_id: interestedRaw === "" ? null : interestedRaw,
    initial_note: (formData.get("initial_note") as string)?.trim() || undefined,
  });

  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fe[path]) fe[path] = issue.message;
    }
    return { fieldErrors: fe };
  }

  const data = parsed.data;
  const normalisedEmail = data.email.toLowerCase();

  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("phone", data.phone)
    .eq("email", normalisedEmail)
    .maybeSingle();

  if (existing) {
    redirect(`/admin/customers/${existing.id}`);
  }

  const { data: created, error } = await supabase
    .from("customers")
    .insert({
      name: data.name,
      phone: data.phone,
      email: normalisedEmail,
      lead_status: data.lead_status,
      lead_source: data.lead_source ?? null,
      interested_car_id: data.interested_car_id ?? null,
    })
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Could not create lead." };

  await supabase.from("customer_activities").insert([
    {
      customer_id: created.id,
      kind: "lead_created",
      metadata: { source: data.lead_source ?? null },
      created_by: user.id,
    },
    ...(data.initial_note
      ? [
          {
            customer_id: created.id,
            kind: "note" as const,
            body: data.initial_note,
            created_by: user.id,
          },
        ]
      : []),
  ]);

  revalidatePath("/admin/customers");
  redirect(`/admin/customers/${created.id}`);
}
