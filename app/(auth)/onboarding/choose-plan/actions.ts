"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getActiveMembershipOrNull } from "@/lib/tenant";
import type { Plan } from "@/lib/plan";

const TRIAL_DAYS = 7;

// Maps the value posted from the form (`plan` field) to the actual plan tier
// stored on the org. "free" → permanent free; "starter"/"pro" → 7-day trial
// of that tier (auto-rolls back to free when the trial expires).
function resolvePlan(formValue: string): { plan: Plan; trialEndsAt: string | null } {
  if (formValue === "free") {
    return { plan: "free", trialEndsAt: null };
  }
  if (formValue === "starter") {
    return {
      plan: "starter_trial",
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  if (formValue === "pro") {
    return {
      plan: "pro_trial",
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  // Fallback: treat anything unexpected as free.
  return { plan: "free", trialEndsAt: null };
}

export async function startTrial(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getActiveMembershipOrNull();
  if (!membership) redirect("/onboarding");

  const formValue = String(formData.get("plan") ?? "free");
  const { plan, trialEndsAt } = resolvePlan(formValue);

  // Use the service client: org updates need to bypass RLS write checks
  // for plan/trial fields, and we trust the membership check above.
  const service = createSupabaseServiceClient();
  await service
    .from("organizations")
    .update({ plan, trial_ends_at: trialEndsAt })
    .eq("id", membership.orgId);

  // Stripe checkout will be wired here later for paid plans. For now everyone
  // lands on /admin — paid trial users have 7 days before they get prompted.
  redirect("/admin");
}
