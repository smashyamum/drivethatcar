import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/tenant";
import { PLAN_LABEL, type Plan } from "@/lib/plan";
import type { Organization } from "@/lib/supabase/types";
import { openBillingPortal, startCheckout } from "./actions";

export const metadata = { title: "Billing · Admin" };

const PLAN_OPTIONS = [
  {
    id: "starter",
    name: "Starter",
    monthly: 14.99,
    yearly: 9.99,
    yearlyTotal: 119.88,
    features: [
      "Up to 10 cars listed",
      "Unlimited bookings & customers",
      "Automated email reminders",
      "Public booking page",
      "CSV car import",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 29.99,
    yearly: 19.99,
    yearlyTotal: 239.88,
    features: [
      "Unlimited cars",
      "Everything in Starter",
      "Custom booking page address",
      "Team members & roles (up to 5)",
      "Sales analytics & leaderboard",
      "Priority support",
    ],
  },
] as const;

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const orgId = await getActiveOrgId();
  const { data: orgData } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();
  const org = orgData as Organization | null;
  const plan = (org?.plan ?? "free") as Plan;
  const trialEndsAt = org?.trial_ends_at ? new Date(org.trial_ends_at) : null;
  const periodEnd = org?.current_period_end ? new Date(org.current_period_end) : null;
  const hasStripeSubscription = !!org?.stripe_subscription_id;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Manage your plan, payment method, and invoices.
        </p>
      </div>

      {params.success === "1" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Subscription confirmed. Your new plan is active — thanks!
        </div>
      )}
      {params.canceled === "1" && (
        <div className="rounded-md border border-border bg-bg-subtle px-4 py-3 text-sm text-fg-muted">
          Checkout canceled. No charges were made.
        </div>
      )}
      {params.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Something went wrong: {params.error}. Try again or contact support.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardDescription>Current plan</CardDescription>
          <CardTitle>{PLAN_LABEL[plan]}</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-3 text-sm">
          {plan === "free" && (
            <p className="text-fg-muted">
              You&rsquo;re on the free plan. Limits: 2 cars, 30 bookings, 30 customers.
              Upgrade to remove limits and unlock more features.
            </p>
          )}
          {(plan === "starter_trial" || plan === "pro_trial") && (
            <>
              <p className="text-fg-muted">
                You&rsquo;re on a 7-day free trial of {plan === "pro_trial" ? "Pro" : "Starter"}.
              </p>
              {trialEndsAt && (
                <p className="text-fg-muted">
                  Trial ends <span className="font-medium text-fg">{trialEndsAt.toLocaleDateString()}</span>.
                </p>
              )}
            </>
          )}
          {(plan === "starter" || plan === "pro") && (
            <>
              <p className="text-fg-muted">
                You&rsquo;re subscribed to {PLAN_LABEL[plan]}.
              </p>
              {periodEnd && (
                <p className="text-fg-muted">
                  Next billing date: <span className="font-medium text-fg">{periodEnd.toLocaleDateString()}</span>.
                </p>
              )}
            </>
          )}
          {hasStripeSubscription && (
            <div className="mt-1">
              <form action={openBillingPortal}>
                <Button type="submit" variant="secondary">
                  Manage subscription / payment method
                </Button>
              </form>
            </div>
          )}
        </div>
      </Card>

      {/* Plan selector — always visible so dealers can compare and switch
          billing cycle, except when already on the top paid tier. */}
      {plan !== "pro" && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
            {plan === "free" ? "Upgrade your plan" : "Switch plan"}
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PLAN_OPTIONS.map((p) => {
              const isHighlighted = p.id === "pro";
              return (
                <div
                  key={p.id}
                  className={`flex flex-col gap-5 rounded-xl border-2 p-6 ${isHighlighted ? "border-fg" : "border-border"}`}
                >
                  {isHighlighted && (
                    <span className="self-start rounded-full bg-fg px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-bg">
                      Most popular
                    </span>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold">{p.name}</h3>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-bold">${p.monthly}</span>
                      <span className="text-sm text-fg-muted">/mo</span>
                    </div>
                    <p className="text-xs text-fg-muted">
                      Or ${p.yearly}/mo billed yearly (${p.yearlyTotal}/yr)
                    </p>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 text-emerald-600">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto flex flex-col gap-2">
                    <form action={startCheckout}>
                      <input type="hidden" name="plan" value={p.id} />
                      <input type="hidden" name="billing" value="monthly" />
                      <Button type="submit" className="w-full">
                        Subscribe — ${p.monthly}/mo
                      </Button>
                    </form>
                    <form action={startCheckout}>
                      <input type="hidden" name="plan" value={p.id} />
                      <input type="hidden" name="billing" value="yearly" />
                      <Button type="submit" variant="secondary" className="w-full">
                        Subscribe yearly — ${p.yearly}/mo
                      </Button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
