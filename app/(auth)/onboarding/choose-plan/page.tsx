import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrNull } from "@/lib/tenant";
import { PlanPicker } from "./plan-picker";

export const metadata = { title: "Choose your plan · Drive That Car" };

export default async function ChoosePlanPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getActiveMembershipOrNull();
  if (!membership) redirect("/onboarding");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          You&rsquo;re almost there — choose a plan
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Start with a 7-day free trial on any plan. No credit card required.
        </p>
      </div>
      <PlanPicker />
    </div>
  );
}
