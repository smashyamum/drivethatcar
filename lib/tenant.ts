import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";
import { getPlanLimits, type Plan, type PlanLimits } from "./plan";
import type { Role } from "./supabase/types";

export type ActiveMembership = {
  orgId: string;
  role: Role;
};

export type ActiveOrg = {
  id: string;
  plan: Plan;
  limits: PlanLimits;
  role: Role;
};

// Returns the user's membership or null. Use this in callback / onboarding
// pages where redirecting to /login isn't right (the user IS authed, they
// just haven't joined an org yet).
export const getActiveMembershipOrNull = cache(
  async (): Promise<ActiveMembership | null> => {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("memberships")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    return { orgId: data.organization_id as string, role: data.role as Role };
  },
);

// Cached per-request so multiple server components calling this in parallel
// only hit the DB once.
export const getActiveMembership = cache(async (): Promise<ActiveMembership> => {
  const m = await getActiveMembershipOrNull();
  if (!m) redirect("/login");
  return m;
});

export async function getActiveOrgId(): Promise<string> {
  const { orgId } = await getActiveMembership();
  return orgId;
}

// Loads the org row + computes the plan limits. Cached per-request so
// multiple gates in the same request don't repeatedly hit the DB.
export const getActiveOrg = cache(async (): Promise<ActiveOrg> => {
  const { orgId, role } = await getActiveMembership();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organizations")
    .select("id, plan")
    .eq("id", orgId)
    .maybeSingle();
  const plan = ((data?.plan as Plan | undefined) ?? "free") as Plan;
  return { id: orgId, plan, limits: getPlanLimits(plan), role };
});
