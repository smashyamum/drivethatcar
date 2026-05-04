import "server-only";
import { Resend } from "resend";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Tailwind,
  Text,
} from "@react-email/components";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { DEFAULT_SENDER } from "./send";
import type { Settings } from "@/lib/supabase/types";

let _resend: Resend | null = null;
function resend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

type Args = {
  to: string;
  subject: string;
  body: string;
  customerName: string;
};

export async function sendCustomerEmail({
  to,
  subject,
  body,
  customerName,
}: Args): Promise<{ id?: string; error?: string }> {
  const supabase = createSupabaseServiceClient();

  const { data: settingsData } = await supabase.from("settings").select("*").eq("id", 1).single();
  const settings = settingsData as Settings | null;
  const businessName = settings?.business_name ?? "Car Booking";
  const from = settings?.resend_from_email
    ? `${businessName} <${settings.resend_from_email}>`
    : DEFAULT_SENDER;

  try {
    const { data, error } = await resend().emails.send({
      from,
      to,
      subject,
      react: <CustomerEmail body={body} customerName={customerName} businessName={businessName} contactPhone={settings?.contact_phone ?? null} />,
    });
    if (error) return { error: error.message };
    return { id: data?.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function CustomerEmail({
  body,
  customerName,
  businessName,
  contactPhone,
}: {
  body: string;
  customerName: string;
  businessName: string;
  contactPhone: string | null;
}) {
  const previewText = body.slice(0, 120).replace(/\n+/g, " ");
  const paragraphs = body.split(/\n{2,}/);

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-[#f8f9fa] font-sans text-[#374151]">
          <Container className="mx-auto my-10 max-w-[560px] rounded-[12px] border border-[#e5e7eb] bg-white p-10">
            <Text className="m-0 mb-4 text-base text-[#374151]">
              Hi {customerName.split(" ")[0]},
            </Text>
            {paragraphs.map((p, i) => (
              <Text key={i} className="m-0 mb-4 text-base text-[#374151] whitespace-pre-line">
                {p}
              </Text>
            ))}
            <Hr className="my-8 border-[#e5e7eb]" />
            <Text className="m-0 text-center text-xs text-[#898989]">
              {businessName}
              {contactPhone ? ` · ${contactPhone}` : ""}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
