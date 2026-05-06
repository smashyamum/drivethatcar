import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrNull } from "@/lib/tenant";
import { buildOrgSlugBase } from "@/lib/slug";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Set up your account · Drive That Car" };

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Already onboarded? Send straight to /admin.
  const membership = await getActiveMembershipOrNull();
  if (membership) redirect("/admin");

  const businessName =
    (user.user_metadata?.business_name as string | undefined)?.trim() || "";
  const suggestedSlug = buildOrgSlugBase(businessName);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const publicHostLabel = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome — let&rsquo;s get you set up
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Five quick steps and you&rsquo;re ready to add your first car.
        </p>
      </div>
      <OnboardingForm
        initialBusinessName={businessName}
        initialSuggestedSlug={suggestedSlug}
        contactEmail={user.email ?? ""}
        publicHostLabel={publicHostLabel}
      />
    </div>
  );
}
