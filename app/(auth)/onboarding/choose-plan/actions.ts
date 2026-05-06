"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getActiveMembershipOrNull } from "@/lib/tenant";
import {
  getPriceId,
  stripeClient,
  type BillingCycle,
  type CheckoutPlan,
} from "@/lib/stripe";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
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

  // Free path: no Stripe involvement — just downgrade the org and continue.
  if (formValue === "free") {
    const service = createSupabaseServiceClient();
    await service
      .from("organizations")
      .update({ plan: "free", trial_ends_at: null })
      .eq("id", membership.orgId);
    redirect("/admin");
  }

  if (formValue !== "starter" && formValue !== "pro") {
    redirect("/onboarding/choose-plan?error=invalid_plan");
  }
  const plan = formValue as CheckoutPlan;
  const billing = String(formData.get("billing") ?? "monthly") as BillingCycle;

  const service = createSupabaseServiceClient();
  const { data: org } = await service
    .from("organizations")
    .select("id, name, stripe_customer_id")
    .eq("id", membership.orgId)
    .single();
  if (!org) redirect("/onboarding/choose-plan?error=org_not_found");

  const stripe = stripeClient();

  // Reuse an existing Stripe Customer if we already created one; otherwise
  // create one keyed to this org so the webhook can find it later.
  let customerId = org.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.name,
      email: user.email ?? undefined,
      metadata: { organization_id: membership.orgId },
    });
    customerId = customer.id;
    await service
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", membership.orgId);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: getPriceId(plan, billing), quantity: 1 }],
    success_url: `${siteUrl()}/admin?welcome=1`,
    cancel_url: `${siteUrl()}/onboarding/choose-plan?canceled=1`,
    subscription_data: {
      trial_period_days: 7,
      metadata: { organization_id: membership.orgId },
    },
    // Force card-on-file so we can auto-charge on day 8 unless they cancel.
    payment_method_collection: "always",
    allow_promotion_codes: true,
    billing_address_collection: "auto",
  });

  if (!session.url) {
    redirect("/onboarding/choose-plan?error=checkout_failed");
  }
  redirect(session.url);
}
