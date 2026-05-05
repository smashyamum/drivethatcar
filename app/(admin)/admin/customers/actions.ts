"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});

/**
 * Bulk-delete leads. Cascades through bookings (since FK is on delete
 * restrict, we delete bookings explicitly first), then customer_activities
 * cascade automatically. No cancellation emails are sent — when an admin
 * deletes a lead they're cleaning up, not notifying the customer; if they
 * need to notify they can cancel the booking first.
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

  // Cascade: drop the bookings first (FK is on delete restrict).
  const { error: bookingsErr, count: bookingsDeleted } = await supabase
    .from("bookings")
    .delete({ count: "exact" })
    .in("customer_id", parsed.data.ids);
  if (bookingsErr) {
    redirect(
      `${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(bookingsErr.message)}`,
    );
  }

  const { error, count } = await supabase
    .from("customers")
    .delete({ count: "exact" })
    .in("id", parsed.data.ids);
  if (error) {
    redirect(
      `${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/admin/customers");
  revalidatePath("/admin/bookings");

  const result = new URLSearchParams(params);
  result.set("deleted", String(count ?? 0));
  if ((bookingsDeleted ?? 0) > 0) result.set("bookings", String(bookingsDeleted));
  redirect(`/admin/customers?${result.toString()}`);
}

export async function deleteLead(id: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Cascade: bookings first (FK is on delete restrict), then customer.
  const { error: bookingsErr, count: bookingsDeleted } = await supabase
    .from("bookings")
    .delete({ count: "exact" })
    .eq("customer_id", id);
  if (bookingsErr) {
    redirect(`/admin/customers/${id}?error=${encodeURIComponent(bookingsErr.message)}`);
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
  revalidatePath("/admin/bookings");
  const params = new URLSearchParams({ deleted: "1" });
  if ((bookingsDeleted ?? 0) > 0) params.set("bookings", String(bookingsDeleted));
  redirect(`/admin/customers?${params}`);
}
