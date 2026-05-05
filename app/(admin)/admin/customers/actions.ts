"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});

/**
 * Bulk-delete leads. Customers that still have bookings attached
 * (bookings.customer_id is on delete restrict) are skipped — the page
 * surfaces the count via ?deleted=&blocked=.
 *
 * customer_activities cascade automatically.
 */
export async function deleteLeads(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rawIds = formData.getAll("ids").filter((v): v is string => typeof v === "string");
  const q = (formData.get("q") as string)?.trim() ?? "";
  const status = (formData.get("status") as string)?.trim() ?? "";

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  const back = params.toString() ? `/admin/customers?${params}` : "/admin/customers";

  const parsed = BulkSchema.safeParse({ ids: rawIds });
  if (!parsed.success) {
    redirect(`${back}${back.includes("?") ? "&" : "?"}error=none_selected`);
  }

  // Find which of the selected leads still have bookings — those can't go.
  const { data: bookingRows } = await supabase
    .from("bookings")
    .select("customer_id")
    .in("customer_id", parsed.data.ids);
  const blockedSet = new Set(
    (bookingRows ?? []).map((r) => (r as { customer_id: string }).customer_id),
  );
  const deletable = parsed.data.ids.filter((id) => !blockedSet.has(id));

  let deleted = 0;
  if (deletable.length > 0) {
    const { error, count } = await supabase
      .from("customers")
      .delete({ count: "exact" })
      .in("id", deletable);
    if (error) {
      redirect(
        `${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(error.message)}`,
      );
    }
    deleted = count ?? deletable.length;
  }

  revalidatePath("/admin/customers");

  const result = new URLSearchParams(params);
  result.set("deleted", String(deleted));
  if (blockedSet.size > 0) result.set("blocked", String(blockedSet.size));
  redirect(`/admin/customers?${result.toString()}`);
}

export async function deleteLead(id: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { count: bookingCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", id);

  if ((bookingCount ?? 0) > 0) {
    redirect(`/admin/customers/${id}?error=has_bookings`);
  }

  const { error, count } = await supabase
    .from("customers")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    redirect(`/admin/customers/${id}?error=${encodeURIComponent(error.message)}`);
  }
  if ((count ?? 0) === 0) {
    redirect(`/admin/customers/${id}?error=no_rows_affected`);
  }

  revalidatePath("/admin/customers");
  redirect("/admin/customers?deleted=1");
}
