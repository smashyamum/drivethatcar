"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { startTrial } from "./actions";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    desc: "Perfect for solo dealers.",
    monthly: 14.99,
    yearly: 9.99,
    yearlyTotal: 119.88,
    highlighted: false,
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
    desc: "For growing dealerships.",
    monthly: 29.99,
    yearly: 19.99,
    yearlyTotal: 239.88,
    highlighted: true,
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

function TrialButton({ plan, billing }: { plan: string; billing: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending} name="plan" value={plan}>
      {pending ? "Starting trial…" : "Start 7-day free trial"}
    </Button>
  );
}

export function PlanPicker() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <div className="flex flex-col gap-8">
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setBilling("monthly")}
          className={`text-sm font-medium transition-colors ${billing === "monthly" ? "text-fg" : "text-fg-muted hover:text-fg"}`}
        >
          Monthly
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={billing === "yearly"}
          onClick={() => setBilling(billing === "monthly" ? "yearly" : "monthly")}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${billing === "yearly" ? "bg-fg" : "bg-fg-muted/30"}`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-bg shadow-lg ring-0 transition-transform ${billing === "yearly" ? "translate-x-5" : "translate-x-0"}`}
          />
        </button>
        <button
          type="button"
          onClick={() => setBilling("yearly")}
          className={`text-sm font-medium transition-colors ${billing === "yearly" ? "text-fg" : "text-fg-muted hover:text-fg"}`}
        >
          Yearly
          <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
            Save ~33%
          </span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PLANS.map((plan) => {
          const price = billing === "yearly" ? plan.yearly : plan.monthly;
          return (
            <div
              key={plan.id}
              className={`flex flex-col gap-5 rounded-xl border-2 p-6 ${plan.highlighted ? "border-fg bg-bg" : "border-border bg-bg"}`}
            >
              {plan.highlighted && (
                <span className="self-start rounded-full bg-fg px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-bg">
                  Most popular
                </span>
              )}
              <div>
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                <p className="mt-0.5 text-sm text-fg-muted">{plan.desc}</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">${price}</span>
                <span className="text-sm text-fg-muted">/mo</span>
              </div>
              {billing === "yearly" && (
                <p className="text-xs text-fg-muted">
                  Billed as ${plan.yearlyTotal} / year
                </p>
              )}
              <ul className="flex flex-col gap-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-emerald-600">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <form action={startTrial} className="mt-auto">
                <input type="hidden" name="billing" value={billing} />
                <TrialButton plan={plan.id} billing={billing} />
              </form>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-fg-muted">
        No credit card needed for the free trial. You&apos;ll choose billing after 7 days.
      </p>
    </div>
  );
}
