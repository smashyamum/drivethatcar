"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/supabase/types";
import { sendCustomerEmail } from "@/lib/email/customer-email";

export type ActionState = { error?: string; ok?: boolean };

async function authedClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return { error: "Not authenticated" as const };

  return { supabase, userId: user.id, orgId: membership.organization_id as string };
}

function revalidate(id: string) {
  revalidatePath(`/admin/customers/${id}`);
  revalidatePath("/admin/customers");
}

const NoteSchema = z.object({
  customerId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

export async function addNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authedClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = NoteSchema.safeParse({
    customerId: formData.get("customerId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: "Note can't be empty." };

  const { error } = await auth.supabase.from("customer_activities").insert({
    organization_id: auth.orgId,
    customer_id: parsed.data.customerId,
    kind: "note",
    body: parsed.data.body,
    created_by: auth.userId,
  });
  if (error) return { error: error.message };

  revalidate(parsed.data.customerId);
  return { ok: true };
}

const CallLogSchema = z.object({
  customerId: z.string().uuid(),
  body: z.string().trim().max(2000).optional(),
});

export async function logCall(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authedClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = CallLogSchema.safeParse({
    customerId: formData.get("customerId"),
    body: (formData.get("body") as string)?.trim() || undefined,
  });
  if (!parsed.success) return { error: "Invalid input." };

  const { error } = await auth.supabase.from("customer_activities").insert({
    organization_id: auth.orgId,
    customer_id: parsed.data.customerId,
    kind: "call",
    body: parsed.data.body ?? null,
    created_by: auth.userId,
  });
  if (error) return { error: error.message };

  revalidate(parsed.data.customerId);
  return { ok: true };
}

const StatusSchema = z.object({
  customerId: z.string().uuid(),
  status: z.enum(LEAD_STATUSES as [LeadStatus, ...LeadStatus[]]),
});

export async function setLeadStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authedClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = StatusSchema.safeParse({
    customerId: formData.get("customerId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: "Invalid status." };

  const { data: existing } = await auth.supabase
    .from("customers")
    .select("lead_status")
    .eq("id", parsed.data.customerId)
    .single();
  const previous = existing?.lead_status as LeadStatus | undefined;

  if (previous === parsed.data.status) return { ok: true };

  // Stamp sold_at when flipping to 'sold' (clear it if leaving 'sold').
  // Analytics buckets sales by sold_at, so this needs to be precise.
  const update: Record<string, unknown> = { lead_status: parsed.data.status };
  if (parsed.data.status === "sold") {
    update.sold_at = new Date().toISOString();
  } else if (previous === "sold") {
    update.sold_at = null;
  }

  const { error } = await auth.supabase
    .from("customers")
    .update(update)
    .eq("id", parsed.data.customerId);
  if (error) return { error: error.message };

  await auth.supabase.from("customer_activities").insert({
    organization_id: auth.orgId,
    customer_id: parsed.data.customerId,
    kind: "status_change",
    metadata: { from: previous ?? null, to: parsed.data.status },
    created_by: auth.userId,
  });

  revalidate(parsed.data.customerId);
  return { ok: true };
}

const FollowUpSchema = z.object({
  customerId: z.string().uuid(),
  date: z.string().nullable(),
});

export async function setFollowUp(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authedClient();
  if ("error" in auth) return { error: auth.error };

  const raw = (formData.get("date") as string)?.trim() ?? "";
  const parsed = FollowUpSchema.safeParse({
    customerId: formData.get("customerId"),
    date: raw === "" ? null : raw,
  });
  if (!parsed.success) return { error: "Invalid date." };

  let iso: string | null = null;
  if (parsed.data.date) {
    const d = new Date(parsed.data.date);
    if (Number.isNaN(d.getTime())) return { error: "Invalid date." };
    iso = d.toISOString();
  }

  const { error } = await auth.supabase
    .from("customers")
    .update({ next_follow_up_at: iso })
    .eq("id", parsed.data.customerId);
  if (error) return { error: error.message };

  await auth.supabase.from("customer_activities").insert({
    organization_id: auth.orgId,
    customer_id: parsed.data.customerId,
    kind: "follow_up_set",
    metadata: { at: iso },
    created_by: auth.userId,
  });

  revalidate(parsed.data.customerId);
  return { ok: true };
}

const WhatsAppSchema = z.object({
  customerId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

export async function logWhatsApp(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authedClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = WhatsAppSchema.safeParse({
    customerId: formData.get("customerId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: "Message can't be empty." };

  const { error } = await auth.supabase.from("customer_activities").insert({
    organization_id: auth.orgId,
    customer_id: parsed.data.customerId,
    kind: "whatsapp_sent",
    body: parsed.data.body,
    created_by: auth.userId,
  });
  if (error) return { error: error.message };

  revalidate(parsed.data.customerId);
  return { ok: true };
}

const EmailSchema = z.object({
  customerId: z.string().uuid(),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(8000),
});

export async function sendEmail(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authedClient();
  if ("error" in auth) return { error: auth.error };

  const parsed = EmailSchema.safeParse({
    customerId: formData.get("customerId"),
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: "Subject and message are required." };

  const { data: customer } = await auth.supabase
    .from("customers")
    .select("email, name")
    .eq("id", parsed.data.customerId)
    .single();
  if (!customer) return { error: "Customer not found." };

  const result = await sendCustomerEmail({
    to: customer.email,
    subject: parsed.data.subject,
    body: parsed.data.body,
    customerName: customer.name as string,
  });
  if (result.error) return { error: result.error };

  await auth.supabase.from("customer_activities").insert({
    organization_id: auth.orgId,
    customer_id: parsed.data.customerId,
    kind: "email_sent",
    body: parsed.data.body,
    metadata: { subject: parsed.data.subject, resend_id: result.id ?? null },
    created_by: auth.userId,
  });

  revalidate(parsed.data.customerId);
  return { ok: true };
}
