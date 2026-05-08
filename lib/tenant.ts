import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
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

/**
 * Single per-request cache for the signed-in auth user. Calling this multiple
 * times in one request hits Supabase auth ONCE — without it, every helper
 * (getActiveMembershipOrNull, getActiveMembership, getActiveOrg, plus every
 * page that reads user.email) was re-validating the JWT against Supabase.
 * That was 4–5 round-trips per page render.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Returns membership + org plan in a single query (joined). Was two
 * sequential round-trips previously — `memberships` then `organizations`.
 * Cached per request so callers can use it freely without thrashing the DB.
 */
const getActiveTenantOrNull = cache(
  async (): Promise<{ orgId: string; role: Role; plan: Plan } | null> => {
    const user = await getCurrentUser();
    if (!user) return null;

    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("memberships")
      .select("organization_id, role, organizations(id, plan)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    // The nested select returns a single row (Supabase types this loosely).
    const orgRow = data.organizations as
      | { id: string; plan: string }
      | { id: string; plan: string }[]
      | null;
    const org = Array.isArray(orgRow) ? orgRow[0] : orgRow;
    const plan = (org?.plan as Plan | undefined) ?? "free";

    return {
      orgId: data.organization_id as string,
      role: data.role as Role,
      plan,
    };
  },
);

// Returns the user's membership or null. Use this in callback / onboarding
// pages where redirecting to /login isn't right (the user IS authed, they
// just haven't joined an org yet).
export const getActiveMembershipOrNull = cache(
  async (): Promise<ActiveMembership | null> => {
    const tenant = await getActiveTenantOrNull();
    return tenant ? { orgId: tenant.orgId, role: tenant.role } : null;
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
  const tenant = await getActiveTenantOrNull();
  if (!tenant) redirect("/login");
  return {
    id: tenant.orgId,
    plan: tenant.plan,
    limits: getPlanLimits(tenant.plan),
    role: tenant.role,
  };
});
