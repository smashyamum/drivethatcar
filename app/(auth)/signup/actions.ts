"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PasswordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long");

const SignUpSchemaDefault = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: PasswordField,
  business_name: z
    .string()
    .trim()
    .min(2, "Business name is required")
    .max(120, "Business name is too long"),
});

const SignUpSchemaInvite = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: PasswordField,
});

export type SignUpState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Allow only same-origin /accept-invite/* destinations through `next`. */
function safeNext(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (!value.startsWith("/accept-invite/")) return null;
  return value;
}

export async function signUp(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const next = safeNext(formData.get("next"));
  const isInvite = next !== null;

  const parsed = isInvite
    ? SignUpSchemaInvite.safeParse({
        email: formData.get("email"),
        password: formData.get("password"),
      })
    : SignUpSchemaDefault.safeParse({
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
  // Invitees don't pick a business name — they're joining one. Drop the
  // metadata field so the onboarding flow knows not to prefill.
  const userMetadata = isInvite
    ? {}
    : { business_name: (parsed.data as unknown as { business_name: string }).business_name };

  // Pass `next` along the email-verification redirect so we can route the
  // user back to the invite-accept page after they confirm.
  const callbackUrl = next
    ? `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`
    : `${siteUrl()}/auth/callback`;

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: userMetadata,
      emailRedirectTo: callbackUrl,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return {
        error: isInvite
          ? "This email already has an account — sign in instead to accept the invite."
          : "This email is already registered. Try logging in.",
      };
    }
    return { error: error.message };
  }

  // If Supabase has email confirmation disabled (only happens in dev), we
  // already have a session — bypass the verify page entirely.
  if (data.session) {
    redirect(next ?? "/onboarding");
  }

  const verifyParams = new URLSearchParams({ email: parsed.data.email });
  if (next) verifyParams.set("next", next);
  redirect(`/signup/verify?${verifyParams.toString()}`);
}
