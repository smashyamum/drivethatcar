"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrNull } from "@/lib/tenant";

const VerifySchema = z.object({
  email: z.string().trim().email(),
  token: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
});

const ResendSchema = z.object({
  email: z.string().trim().email(),
});

export type VerifyState = { error?: string };
export type ResendState = { sent?: boolean; error?: string };

export async function verifyCode(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const parsed = VerifySchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid code" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "signup",
  });

  if (error) {
    if (error.message.toLowerCase().includes("expired")) {
      return { error: "That code has expired. Sign up again to get a new one." };
    }
    if (error.message.toLowerCase().includes("invalid")) {
      return { error: "That code isn't right — double-check the email and try again." };
    }
    return { error: error.message };
  }

  const membership = await getActiveMembershipOrNull();
  redirect(membership ? "/admin" : "/onboarding");
}

export async function resendCode(
  _prev: ResendState,
  formData: FormData,
): Promise<ResendState> {
  const parsed = ResendSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: "Missing email address." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
  });

  if (error) {
    if (error.message.toLowerCase().includes("rate limit")) {
      return { error: "Please wait a minute before requesting another code." };
    }
    return { error: error.message };
  }

  return { sent: true };
}
