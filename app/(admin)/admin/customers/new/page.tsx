import Link from "next/link";
import { NewLeadForm } from "@/components/admin/new-lead-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Car } from "@/lib/supabase/types";

export const metadata = { title: "New lead · Admin" };

export default async function NewLeadPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("cars")
    .select("id, year, make, model, variant")
    .eq("status", "available")
    .order("created_at", { ascending: false });

  const cars = (data ?? []) as Pick<Car, "id" | "year" | "make" | "model" | "variant">[];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link
          href="/admin/customers"
          className="text-sm text-fg-muted hover:text-fg"
        >
          ← All customers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New lead</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Capture a walk-in, phone enquiry, or referral. If a customer already exists with the
          same phone &amp; email, you&rsquo;ll be redirected to their record.
        </p>
      </div>
      <NewLeadForm cars={cars} />
    </div>
  );
}
