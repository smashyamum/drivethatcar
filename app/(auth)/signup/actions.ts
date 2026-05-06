"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SignUpSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password is too long"),
  business_name: z
    .string()
    .trim()
    .min(2, "Business name is required")
    .max(120, "Business name is too long"),
});

export type SignUpState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function signUp(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const parsed = SignUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    business_name: formData.get("business_name"),
  });

  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fe[path]) fe[path] = issue.message;
    }
    return { fieldErrors: fe };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { business_name: parsed.data.business_name },
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "This email is already registered. Try logging in." };
    }
    return { error: error.message };
  }

  // If Supabase project has email confirmation disabled, signUp returns a
  // session immediately. Send them straight into onboarding.
  if (data.session) {
    redirect("/onboarding");
  }

  redirect(`/signup/verify?email=${encodeURIComponent(parsed.data.email)}`);
}
