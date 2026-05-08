import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

/**
 * Per-request cached server client. We were spinning up a fresh client (and
 * therefore re-validating the session) on every helper call — three or four
 * times per page render. Wrapping in React's `cache()` collapses them to
 * one client per request, which means auth.getUser() inside that client
 * caches its JWT verification across the whole render.
 */
export const createSupabaseServerClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a server component; safe to ignore — middleware refreshes the session.
          }
        },
      },
    },
  );
});
