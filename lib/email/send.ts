import "server-only";
import { Resend } from "resend";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type EmailTemplate = "confirmation" | "cancellation" | "reschedule" | "reminder";

type Attachment = {
  filename: string;
  content: string; // raw content (utf-8 for ICS)
  contentType?: string;
};

type SendArgs = {
  to: string;
  from: string;
  subject: string;
  react: React.ReactElement;
  attachments?: Attachment[];
  template: EmailTemplate;
  bookingId?: string;
};

let _resend: Resend | null = null;
function resend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendBookingEmail({
  to,
  from,
  subject,
  react,
  attachments,
  template,
  bookingId,
}: SendArgs): Promise<{ id?: string; error?: string }> {
  const supabase = createSupabaseServiceClient();
  let resendId: string | undefined;
  let errorMessage: string | undefined;

  try {
    const { data, error } = await resend().emails.send({
      from,
      to,
      subject,
      react,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, "utf-8"),
        contentType: a.contentType,
      })),
    });
    if (error) {
      errorMessage = error.message;
    } else {
      resendId = data?.id;
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  // Best-effort audit log; don't fail the calling action if logging fails.
  try {
    await supabase.from("email_log").insert({
      booking_id: bookingId ?? null,
      template,
      to_email: to,
      resend_id: resendId ?? null,
      error: errorMessage ?? null,
    });
  } catch {
    // intentionally ignored
  }

  return errorMessage ? { error: errorMessage } : { id: resendId };
}

/** Default sender if the admin hasn't configured a custom domain yet. */
export const DEFAULT_SENDER = "Car Booking <onboarding@resend.dev>";
