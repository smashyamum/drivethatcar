"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendCancellationEmail } from "@/lib/email/booking-emails";
import { verifyManageToken } from "@/lib/tokens";

export async function cancelBookingByCustomer(formData: FormData) {
  const id = formData.get("id") as string | null;
  const token = formData.get("token") as string | null;
  if (!id || !token) throw new Error("Missing booking or token");

  const service = createSupabaseServiceClient();
  const { data: booking } = await service
    .from("bookings")
    .select("id, status, manage_token_hash")
    .eq("id", id)
    .maybeSingle();

  if (!booking) throw new Error("Booking not found");
  if (!verifyManageToken(token, booking.manage_token_hash)) throw new Error("Invalid token");
  if (booking.status === "cancelled") {
    redirect(`/booking/${id}?token=${token}`);
  }

  const { error } = await service
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: "customer",
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await sendCancellationEmail(id).catch((err) => {
    console.error("Failed to send cancellation email", err);
  });

  revalidatePath(`/booking/${id}`);
  revalidatePath("/admin/bookings");
  redirect(`/booking/${id}?token=${token}`);
}
