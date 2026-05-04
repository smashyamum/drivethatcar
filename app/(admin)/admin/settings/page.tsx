import { SettingsForm } from "@/components/admin/settings-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Settings } from "@/lib/supabase/types";

export const metadata = { title: "Settings · Admin" };

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return (
      <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        Could not load settings: {error?.message ?? "missing settings row"}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Working hours and slot rules apply to every car&rsquo;s booking page.
        </p>
      </div>
      <SettingsForm initial={data as Settings} />
    </div>
  );
}
