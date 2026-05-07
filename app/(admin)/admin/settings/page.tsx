import { EmailSenderCard } from "@/components/admin/email-sender-card";
import { SettingsForm } from "@/components/admin/settings-form";
import { SlugCard } from "@/components/admin/slug-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/tenant";
import { getPlatformDomain } from "@/lib/email/config";
import type { Settings } from "@/lib/supabase/types";

export const metadata = { title: "Settings · Admin" };

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const org = await getActiveOrg();

  const { data: settings, error: settingsErr } = await supabase
    .from("settings")
    .select("*")
    .eq("organization_id", org.id)
    .single();

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", org.id)
    .single();

  if (settingsErr || !settings) {
    return (
      <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        Could not load settings: {settingsErr?.message ?? "missing settings row"}
      </div>
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://drivethatcar.app";
  const platformSender =
    process.env.PLATFORM_FROM_EMAIL ?? "Drive That Car <bookings@drivethatcar.app>";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Working hours and slot rules apply to every car&rsquo;s booking page.
        </p>
      </div>
      <SlugCard
        currentSlug={(orgRow?.slug as string | undefined) ?? ""}
        isPro={org.limits.customSlug}
        siteUrl={siteUrl}
      />
      <EmailSenderCard
        emailTier={org.limits.customerEmails}
        platformSender={platformSender}
        platformDomain={getPlatformDomain()}
        currentResendFromEmail={(settings as Settings).resend_from_email ?? null}
      />
      <SettingsForm initial={settings as Settings} />
    </div>
  );
}
