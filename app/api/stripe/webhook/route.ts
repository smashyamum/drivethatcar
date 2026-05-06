import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { planFromPriceId, stripeClient, webhookSecret } from "@/lib/stripe";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { Plan } from "@/lib/plan";

// Stripe needs the raw body to verify the signature, so disable body parsing.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In recent Stripe API versions current_period_end moved off the subscription
// onto each subscription item. Falls back to the subscription-level field on
// older APIs.
function periodEndUnix(sub: Stripe.Subscription): number | null {
  const item = sub.items.data[0] as
    | (Stripe.SubscriptionItem & { current_period_end?: number })
    | undefined;
  if (item?.current_period_end) return item.current_period_end;
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  return legacy ?? null;
}

// Maps a Stripe subscription's status + price into our internal plan column.
function planFromSubscription(sub: Stripe.Subscription): Plan | null {
  const item = sub.items.data[0];
  if (!item) return null;
  const tier = planFromPriceId(item.price.id);
  if (!tier) return null;

  // tier is "starter" or "pro" — promote to *_trial while still on trial.
  if (sub.status === "trialing") {
    return tier === "pro" ? "pro_trial" : "starter_trial";
  }
  if (sub.status === "active") {
    return tier;
  }
  if (sub.status === "canceled" || sub.status === "incomplete_expired") {
    return "free";
  }
  // past_due / unpaid: keep them on their current paid plan; the customer
  // portal will let them update payment. We mirror the status separately.
  return tier;
}

export async function POST(request: NextRequest) {
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();
  const stripe = stripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bad signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const service = createSupabaseServiceClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId =
        (session.metadata?.organization_id as string | undefined) ??
        (session.subscription
          ? // Some flows put metadata on the subscription instead.
            null
          : null);

      // Fetch the subscription to know which plan was bought.
      if (typeof session.subscription !== "string") break;
      const sub = await stripe.subscriptions.retrieve(session.subscription);

      const resolvedOrgId =
        orgId ?? (sub.metadata?.organization_id as string | undefined) ?? null;
      if (!resolvedOrgId) break;

      const plan = planFromSubscription(sub);
      await service
        .from("organizations")
        .update({
          stripe_customer_id:
            typeof sub.customer === "string" ? sub.customer : sub.customer.id,
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          plan: plan ?? "free",
          current_period_end: (() => {
            const u = periodEndUnix(sub);
            return u ? new Date(u * 1000).toISOString() : null;
          })(),
          trial_ends_at: sub.trial_end
            ? new Date(sub.trial_end * 1000).toISOString()
            : null,
        })
        .eq("id", resolvedOrgId);
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.organization_id as string | undefined;
      if (!orgId) {
        // Fall back to looking up by customer id.
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const { data: org } = await service
          .from("organizations")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        if (!org) break;
        await applySubUpdate(service, org.id as string, sub);
      } else {
        await applySubUpdate(service, orgId, sub);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await service
        .from("organizations")
        .update({
          plan: "free",
          subscription_status: sub.status,
          stripe_subscription_id: null,
          current_period_end: null,
          trial_ends_at: null,
        })
        .eq("stripe_customer_id", customerId);
      break;
    }

    default:
      // Ignore other events. Stripe sends a lot — we only care about subs.
      break;
  }

  return NextResponse.json({ received: true });
}

async function applySubUpdate(
  service: ReturnType<typeof createSupabaseServiceClient>,
  orgId: string,
  sub: Stripe.Subscription,
) {
  const plan = planFromSubscription(sub);
  await service
    .from("organizations")
    .update({
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      plan: plan ?? "free",
      current_period_end: (() => {
        const u = periodEndUnix(sub);
        return u ? new Date(u * 1000).toISOString() : null;
      })(),
      trial_ends_at: sub.trial_end
        ? new Date(sub.trial_end * 1000).toISOString()
        : null,
    })
    .eq("id", orgId);
}
