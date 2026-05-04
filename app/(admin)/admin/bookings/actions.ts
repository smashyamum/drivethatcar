"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendCancellationEmail } from "@/lib/email/booking-emails";
import type { BookingStatus } from "@/lib/supabase/types";

async function requireAuth() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return supabase;
}

export async function setBookingStatus(id: string, status: BookingStatus) {
  const supabase = await requireAuth();
  const update: Record<string, unknown> = { status };
  if (status === "cancelled") {
    update.cancelled_at = new Date().toISOString();
    update.cancelled_by = "admin";
  }
  const { error } = await supabase.from("bookings").update(update).eq("id", id);
  if (error) throw new Error(error.message);

  if (status === "cancelled") {
    await sendCancellationEmail(id).catch((err) => {
      console.error("Failed to send cancellation email", err);
    });
  }

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${id}`);
}
