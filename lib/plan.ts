// Central definition of plan tiers and their feature limits.
// Used both by enforcement code (createCar, etc.) and by UI gates.

export type Plan =
  | "trial" // legacy — the founding dealer; treated as full-access
  | "free"
  | "starter_trial"
  | "starter"
  | "pro_trial"
  | "pro"
  | "suspended";

export type PlanLimits = {
  cars: number;
  bookings: number;
  customers: number;
  csvImport: boolean;
  analytics: boolean;
  team: boolean;
  customSlug: boolean;
  teamSeats: number;
  /**
   * 'none'   = no automated customer emails (Free)
   * 'shared' = sent from the platform's default sender (Starter)
   * 'custom' = dealer can send from their own verified domain (Pro / trial)
   */
  customerEmails: "none" | "shared" | "custom";
};

const UNLIMITED = 999_999;

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  trial: {
    cars: UNLIMITED,
    bookings: UNLIMITED,
    customers: UNLIMITED,
    csvImport: true,
    analytics: true,
    team: true,
    customSlug: true,
    teamSeats: UNLIMITED,
    customerEmails: "custom",
  },
  free: {
    cars: 2,
    bookings: 30,
    customers: 30,
    csvImport: false,
    analytics: false,
    team: false,
    customSlug: false,
    teamSeats: 1,
    customerEmails: "none",
  },
  starter_trial: {
    cars: 10,
    bookings: UNLIMITED,
    customers: UNLIMITED,
    csvImport: true,
    analytics: false,
    team: false,
    customSlug: false,
    teamSeats: 1,
    customerEmails: "shared",
  },
  starter: {
    cars: 10,
    bookings: UNLIMITED,
    customers: UNLIMITED,
    csvImport: true,
    analytics: false,
    team: false,
    customSlug: false,
    teamSeats: 1,
    customerEmails: "shared",
  },
  pro_trial: {
    cars: UNLIMITED,
    bookings: UNLIMITED,
    customers: UNLIMITED,
    csvImport: true,
    analytics: true,
    team: true,
    customSlug: true,
    teamSeats: 5,
    customerEmails: "custom",
  },
  pro: {
    cars: UNLIMITED,
    bookings: UNLIMITED,
    customers: UNLIMITED,
    csvImport: true,
    analytics: true,
    team: true,
    customSlug: true,
    teamSeats: 5,
    customerEmails: "custom",
  },
  suspended: {
    cars: 0,
    bookings: 0,
    customers: 0,
    csvImport: false,
    analytics: false,
    team: false,
    customSlug: false,
    teamSeats: 0,
    customerEmails: "none",
  },
};

export const PLAN_LABEL: Record<Plan, string> = {
  trial: "Trial",
  free: "Free",
  starter_trial: "Starter (trial)",
  starter: "Starter",
  pro_trial: "Pro (trial)",
  pro: "Pro",
  suspended: "Suspended",
};

export function getPlanLimits(plan: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[(plan ?? "free") as Plan] ?? PLAN_LIMITS.free;
}

// Convenience predicates
export const isPro = (plan: string | null | undefined): boolean =>
  plan === "pro" || plan === "pro_trial" || plan === "trial";
export const isPaid = (plan: string | null | undefined): boolean =>
  plan === "starter" || plan === "starter_trial" || isPro(plan);
