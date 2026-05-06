"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  getPriceId,
  stripeClient,
  type BillingCycle,
  type CheckoutPlan,
} from "@/lib/stripe";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getActiveMembership } from "@/lib/tenant";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

const CheckoutSchema = z.object({
  plan: z.enum(["starter", "pro"]),
  billing: z.enum(["monthly", "yearly"]),
});

export async function startCheckout(formData: FormData): Promise<void> {
  const parsed = CheckoutSchema.safeParse({
    plan: formData.get("plan"),
    billing: formData.get("billing"),
  });
  if (!parsed.success) {
    redirect("/admin/settings/billing?error=invalid_plan");
  }
  const plan = parsed.data.plan as CheckoutPlan;
  const billing = parsed.data.billing as BillingCycle;

  const { orgId } = await getActiveMembership();
  const service = createSupabaseServiceClient();
  const { data: org } = await service
    .from("organizations")
    .select("id, name, plan, trial_ends_at, stripe_customer_id")
    .eq("id", orgId)
    .single();
  if (!org) redirect("/admin/settings/billing?error=org_not_found");

  const stripe = stripeClient();

  // Reuse existing customer where we can; create on first checkout otherwise.
  let customerId = org.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.name,
      metadata: { organization_id: orgId },
    });
    customerId = customer.id;
    await service
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", orgId);
  }

  // Honour any time left on the current trial — let Stripe finish it before
  // billing starts. If the trial already ended, this resolves to "no trial".
  const trialEndUnix = org.trial_ends_at
    ? Math.floor(new Date(org.trial_ends_at).getTime() / 1000)
    : null;
  const nowUnix = Math.floor(Date.now() / 1000);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: getPriceId(plan, billing), quantity: 1 }],
    success_url: `${siteUrl()}/admin/settings/billing?success=1`,
    cancel_url: `${siteUrl()}/admin/settings/billing?canceled=1`,
    subscription_data: {
      metadata: { organization_id: orgId },
      ...(trialEndUnix && trialEndUnix > nowUnix
        ? { trial_end: trialEndUnix }
        : {}),
    },
    allow_promotion_codes: true,
    billing_address_collection: "auto",
  });

  if (!session.url) {
    redirect("/admin/settings/billing?error=checkout_failed");
  }
  redirect(session.url);
}

export async function openBillingPortal(): Promise<void> {
  const { orgId } = await getActiveMembership();
  const service = createSupabaseServiceClient();
  const { data: org } = await service
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", orgId)
    .single();

  const customerId = org?.stripe_customer_id as string | null;
  if (!customerId) {
    redirect("/admin/settings/billing?error=no_customer");
  }

  const stripe = stripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId!,
    return_url: `${siteUrl()}/admin/settings/billing`,
  });

  redirect(session.url);
}
