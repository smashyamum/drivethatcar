import "server-only";
import Stripe from "stripe";

// Lazy singleton — Vercel functions cold-start fast and reuse the instance.
let _client: Stripe | null = null;

export function stripeClient(): Stripe {
  if (_client) return _client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it in Vercel → Settings → Environment Variables.",
    );
  }
  // No explicit apiVersion — defaults to the SDK's pinned version, so SDK
  // upgrades and Stripe API version stay in sync automatically.
  _client = new Stripe(key, { typescript: true });
  return _client;
}

// Map our internal plan + billing-cycle pair to a Stripe Price ID. The Price IDs
// live in env so we can swap test/live without code changes. The user creates
// the products in Stripe Dashboard once and pastes the price IDs into Vercel.
export type CheckoutPlan = "starter" | "pro";
export type BillingCycle = "monthly" | "yearly";

export function getPriceId(plan: CheckoutPlan, billing: BillingCycle): string {
  const envKey = `STRIPE_PRICE_${plan.toUpperCase()}_${billing.toUpperCase()}`;
  const value = process.env[envKey];
  if (!value) {
    throw new Error(
      `${envKey} is not set. Create the Price in Stripe → Products and paste the price_... ID into Vercel env vars.`,
    );
  }
  return value;
}

// Map a Stripe Price ID back to our internal plan tier. Used by the webhook
// when a checkout completes — we get the price ID and need to know whether to
// set plan='starter' or 'pro' on the org.
export function planFromPriceId(priceId: string): CheckoutPlan | null {
  const candidates: Array<[string, CheckoutPlan]> = [
    ["STRIPE_PRICE_STARTER_MONTHLY", "starter"],
    ["STRIPE_PRICE_STARTER_YEARLY", "starter"],
    ["STRIPE_PRICE_PRO_MONTHLY", "pro"],
    ["STRIPE_PRICE_PRO_YEARLY", "pro"],
  ];
  for (const [envKey, plan] of candidates) {
    if (process.env[envKey] === priceId) return plan;
  }
  return null;
}

export function webhookSecret(): string {
  const v = process.env.STRIPE_WEBHOOK_SECRET;
  if (!v) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not set. Get it from Stripe → Developers → Webhooks → your endpoint.",
    );
  }
  return v;
}
