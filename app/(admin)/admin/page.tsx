import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard · Admin" };

export default async function AdminDashboard() {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("cars")
    .select("*", { count: "exact", head: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Bookings and customers light up in M3 and M5. For now, manage stock.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/admin/cars">
          <Card className="transition-colors hover:bg-bg-subtle">
            <CardHeader>
              <CardDescription>Cars in stock</CardDescription>
              <CardTitle className="text-3xl">{count ?? 0}</CardTitle>
            </CardHeader>
            <p className="text-sm text-fg-muted">Manage stock →</p>
          </Card>
        </Link>
        <Card className="opacity-60">
          <CardHeader>
            <CardDescription>Bookings (M3)</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
          <p className="text-sm text-fg-muted">Coming next milestone</p>
        </Card>
        <Card className="opacity-60">
          <CardHeader>
            <CardDescription>Customers (M5)</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
          <p className="text-sm text-fg-muted">Coming later</p>
        </Card>
      </div>
    </div>
  );
}
