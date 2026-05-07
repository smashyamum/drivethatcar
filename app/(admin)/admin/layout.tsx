import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrNull, getActiveOrg } from "@/lib/tenant";
import { signOut } from "../login/actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Authenticated but no org yet — they verified email but haven't finished
  // onboarding. Send them through it.
  const membership = await getActiveMembershipOrNull();
  if (!membership) redirect("/onboarding");

  const org = await getActiveOrg();

  return (
    <div className="min-h-screen bg-bg-subtle">
      <header className="border-b border-border bg-bg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-sm font-semibold">
              Car Booking · Admin
            </Link>
            <nav className="flex items-center gap-4 text-sm text-fg-muted">
              <Link href="/admin/cars" className="hover:text-fg">
                Cars
              </Link>
              <Link href="/admin/bookings" className="hover:text-fg">
                Bookings
              </Link>
              <Link href="/admin/customers" className="hover:text-fg">
                Customers
              </Link>
              {org.limits.analytics && (
                <Link href="/admin/analytics" className="hover:text-fg">
                  Analytics
                </Link>
              )}
              <Link href="/admin/settings" className="hover:text-fg">
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-fg-muted">
            <span className="hidden sm:inline">{user.email}</span>
            <form action={signOut}>
              <button type="submit" className="hover:text-fg">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
