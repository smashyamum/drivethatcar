import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrNull } from "@/lib/tenant";

// Supabase email-verification callback. The verification email links to
// `${SITE_URL}/auth/callback?code=…`. We exchange the code for a session,
// then route the user to onboarding (if they haven't joined an org yet)
// or straight to /admin.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorDesc = searchParams.get("error_description");

  if (errorDesc) {
    return NextResponse.redirect(
      `${origin}/signup?error=${encodeURIComponent(errorDesc)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/signup?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Honour `next` for invitee flows (signUp() sets it on emailRedirectTo so
  // invited teammates skip /onboarding and land on the accept-invite page).
  // Locked to same-origin /accept-invite/* paths — never an open redirect.
  const next = searchParams.get("next");
  if (next && next.startsWith("/accept-invite/")) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const membership = await getActiveMembershipOrNull();
  return NextResponse.redirect(
    `${origin}${membership ? "/admin" : "/onboarding"}`,
  );
}
