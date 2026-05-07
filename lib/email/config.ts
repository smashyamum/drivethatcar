import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getPlanLimits, type Plan } from "@/lib/plan";

/**
 * Resolved per-org email send config. The same helper drives every customer-
 * facing email path (booking confirmations, cancellations, reminders,
 * reschedule notices, manual broadcasts) so plan gating stays in one place.
 *
 * - `enabled: false`  → caller MUST short-circuit and not call Resend.
 * - `from`            → ready to pass straight into resend.emails.send({ from }).
 */
export type EmailConfig = {
  enabled: boolean;
  from: string;
  reason?: "free_plan" | "suspended";
};

/** Used when the dealer is on Starter (or hasn't set their own from-address yet on Pro). */
function platformDefaultFrom(): string {
  return (
    process.env.PLATFORM_FROM_EMAIL ??
    "Drive That Car <bookings@drivethatcar.app>"
  );
}

export async function getEmailConfig(orgId: string): Promise<EmailConfig> {
  const service = createSupabaseServiceClient();

  const [{ data: org }, { data: settings }] = await Promise.all([
    service.from("organizations").select("plan").eq("id", orgId).maybeSingle(),
    service
      .from("settings")
      .select("business_name, resend_from_email")
      .eq("organization_id", orgId)
      .maybeSingle(),
  ]);

  const plan = ((org?.plan as Plan | undefined) ?? "free") as Plan;
  const limits = getPlanLimits(plan);

  if (limits.customerEmails === "none") {
    return {
      enabled: false,
      from: "",
      reason: plan === "suspended" ? "suspended" : "free_plan",
    };
  }

  const businessName = (settings?.business_name as string | undefined) ?? "Car Booking";
  const customFrom = (settings?.resend_from_email as string | undefined) ?? null;

  // Pro / trial: use the dealer's own from-address if they've configured one.
  if (limits.customerEmails === "custom" && customFrom) {
    return { enabled: true, from: `${businessName} <${customFrom}>` };
  }

  // Starter — and Pro without a configured custom domain — fall back to the
  // platform default. We still display the dealer's business name as the
  // "friendly" part so the inbox looks right.
  return { enabled: true, from: `${businessName} <${stripDisplayName(platformDefaultFrom())}>` };
}

/** Extracts the bare email part from a "Name <email>" string, or returns it if already bare. */
function stripDisplayName(s: string): string {
  const match = s.match(/<([^>]+)>/);
  return match ? match[1] : s;
}
