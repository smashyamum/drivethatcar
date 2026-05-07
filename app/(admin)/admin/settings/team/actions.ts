"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getActiveMembership, getActiveOrg } from "@/lib/tenant";

const INVITE_TTL_DAYS = 7;

export type InviteState = {
  error?: string;
  ok?: boolean;
  link?: string;
  email?: string;
};

const InviteSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  role: z.enum(["admin", "sales"]),
});

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function newInviteToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(24).toString("base64url");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

// ---------- Invite ----------

export async function createInvite(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const { role: actorRole } = await getActiveMembership();
  if (actorRole !== "owner" && actorRole !== "admin") {
    return { error: "Only owners or admins can invite teammates." };
  }

  const org = await getActiveOrg();
  if (!org.limits.team) {
    return { error: "Inviting teammates is a Pro feature." };
  }

  const parsed = InviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, role } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Check seat capacity (current members + pending invites must not exceed seats).
  const service = createSupabaseServiceClient();
  const [{ count: memberCount }, { count: inviteCount }] = await Promise.all([
    service
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id),
    service
      .from("org_invitations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
  ]);

  const used = (memberCount ?? 0) + (inviteCount ?? 0);
  if (used >= org.limits.teamSeats) {
    return {
      error: `You've used all ${org.limits.teamSeats} seats on your plan. Remove a member or revoke a pending invite first.`,
    };
  }

  const { token, hash } = newInviteToken();
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await service.from("org_invitations").insert({
    organization_id: org.id,
    email: email.toLowerCase(),
    role,
    token_hash: hash,
    invited_by: user.id,
    expires_at: expiresAt,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/settings/team");
  return {
    ok: true,
    link: `${siteUrl()}/accept-invite/${token}`,
    email,
  };
}

// ---------- Revoke ----------

export async function revokeInvite(formData: FormData): Promise<void> {
  const { role } = await getActiveMembership();
  if (role !== "owner" && role !== "admin") return;

  const inviteId = String(formData.get("invite_id") ?? "");
  if (!inviteId) return;

  const org = await getActiveOrg();
  const service = createSupabaseServiceClient();
  await service
    .from("org_invitations")
    .delete()
    .eq("id", inviteId)
    .eq("organization_id", org.id);

  revalidatePath("/admin/settings/team");
}

// ---------- Remove member ----------

export async function removeMember(formData: FormData): Promise<void> {
  const { role: actorRole } = await getActiveMembership();
  if (actorRole !== "owner") return; // only the owner can remove members

  const membershipId = String(formData.get("membership_id") ?? "");
  if (!membershipId) return;

  const org = await getActiveOrg();
  const service = createSupabaseServiceClient();

  const { data: target } = await service
    .from("memberships")
    .select("id, role, organization_id")
    .eq("id", membershipId)
    .single();
  if (!target || target.organization_id !== org.id) return;
  if (target.role === "owner") return; // never remove the owner

  await service.from("memberships").delete().eq("id", membershipId);

  revalidatePath("/admin/settings/team");
}
