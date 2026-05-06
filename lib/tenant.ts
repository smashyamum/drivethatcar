import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";
import type { Role } from "./supabase/types";

export type ActiveMembership = {
  orgId: string;
  role: Role;
};

// Cached per-request so multiple server components calling this in parallel
// only hit the DB once.
export const getActiveMembership = cache(async (): Promise<ActiveMembership> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!data) redirect("/login");

  return { orgId: data.organization_id as string, role: data.role as Role };
});

export async function getActiveOrgId(): Promise<string> {
  const { orgId } = await getActiveMembership();
  return orgId;
}
