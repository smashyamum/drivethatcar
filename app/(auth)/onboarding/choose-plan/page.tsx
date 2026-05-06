import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrNull } from "@/lib/tenant";
import { PlanPicker } from "./plan-picker";

export const metadata = { title: "Choose your plan · Drive That Car" };

export default async function ChoosePlanPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string; error?: string }>;
}) {
  const params = await searchParams;
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
          Start a 7-day free trial. Your card won&rsquo;t be charged until day 8 — cancel anytime before then.
        </p>
      </div>
      {params.canceled === "1" && (
        <div className="rounded-md border border-border bg-bg-subtle px-4 py-3 text-sm text-fg-muted">
          Checkout canceled. No charges were made — pick a plan when you&rsquo;re ready.
        </div>
      )}
      {params.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Something went wrong: {params.error}. Try again or contact support.
        </div>
      )}
      <PlanPicker />
    </div>
  );
}
