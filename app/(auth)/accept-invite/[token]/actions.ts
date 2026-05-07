"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function acceptInvite(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/admin");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/accept-invite/${token}`)}`);

  const service = createSupabaseServiceClient();
  const { data: invite } = await service
    .from("org_invitations")
    .select("id, organization_id, role, expires_at, accepted_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!invite) redirect(`/accept-invite/${token}?error=invalid`);
  if (invite.accepted_at) redirect(`/accept-invite/${token}?error=used`);
  if (new Date(invite.expires_at as string).getTime() < Date.now()) {
    redirect(`/accept-invite/${token}?error=expired`);
  }

  // Already a member of this org? Just redirect them in.
  const { data: existing } = await service
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("organization_id", invite.organization_id as string)
    .maybeSingle();
  if (existing) {
    await service
      .from("org_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id as string);
    redirect("/admin");
  }

  // If the user is a member of a DIFFERENT org, block — v1 = single org per user.
  const { data: otherMembership } = await service
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (otherMembership) {
    redirect(`/accept-invite/${token}?error=already_in_org`);
  }

  // Create the membership and mark the invite as accepted.
  const { error: memErr } = await service.from("memberships").insert({
    organization_id: invite.organization_id,
    user_id: user.id,
    role: invite.role,
  });
  if (memErr) redirect(`/accept-invite/${token}?error=could_not_join`);

  await service
    .from("org_invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id as string);

  redirect("/admin");
}
