"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function startTrial(_formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Stripe integration wired in a later phase — for now the org is already on
  // plan='trial' from onboarding, so just send the user into the dashboard.
  redirect("/admin");
}
