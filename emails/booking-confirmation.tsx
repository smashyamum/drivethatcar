import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export type BookingConfirmationProps = {
  customerName: string;
  carHeadline: string;
  whenLabel: string;
  typeLabel: string;
  reference: string;
  manageUrl: string;
  cancelUrl: string;
  businessName: string;
  contactPhone: string | null;
};

export default function BookingConfirmation({
  customerName,
  carHeadline,
  whenLabel,
  typeLabel,
  reference,
  manageUrl,
  cancelUrl,
  businessName,
  contactPhone,
}: BookingConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>{`You're booked in for the ${carHeadline} on ${whenLabel}`}</Preview>
      <Tailwind>
        <Body className="bg-[#f8f9fa] font-sans text-[#374151]">
          <Container className="mx-auto my-10 max-w-[560px] rounded-[12px] border border-[#e5e7eb] bg-white p-10">
            <Text className="m-0 mb-1 text-xs font-semibold uppercase tracking-wide text-[#10b981]">
              Confirmed
            </Text>
            <Text className="m-0 mb-2 text-[28px] font-semibold tracking-tight text-[#111111]">
              You&rsquo;re booked in
            </Text>
            <Text className="m-0 mb-8 text-base text-[#6b7280]">
              Hi {customerName.split(" ")[0]}, we&rsquo;ve confirmed your {typeLabel.toLowerCase()}.
              The .ics calendar invite is attached — open it to add the slot to your calendar.
            </Text>

            <Section className="rounded-[12px] border border-[#e5e7eb] bg-[#f8f9fa] p-5">
              <Row label="When" value={whenLabel} />
              <Row label="What" value={typeLabel} />
              <Row label="Car" value={carHeadline} />
              <Row label="Reference" value={reference} mono isLast />
            </Section>

            <Section className="mt-6 text-center">
              <Link
                href={manageUrl}
                className="inline-block rounded-md bg-[#111111] px-5 py-3 text-sm font-semibold text-white no-underline"
              >
                View booking
              </Link>
            </Section>
            <Text className="mt-4 text-center text-sm text-[#6b7280]">
              Need to cancel?{" "}
              <Link href={cancelUrl} className="text-[#111111] underline">
                Cancel here
              </Link>
              .
            </Text>

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

function Row({
  label,
  value,
  mono = false,
  isLast = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  isLast?: boolean;
}) {
  return (
    <Section className={isLast ? "" : "mb-3"}>
      <Text className="m-0 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
        {label}
      </Text>
      <Text
        className={`m-0 mt-0.5 text-sm font-semibold text-[#111111] ${mono ? "font-mono" : ""}`}
      >
        {value}
      </Text>
    </Section>
  );
}

BookingConfirmation.PreviewProps = {
  customerName: "Sara Khan",
  carHeadline: "2022 BMW 320d M Sport",
  whenLabel: "Sat 10 May 2026 at 14:00",
  typeLabel: "Viewing",
  reference: "BK-7H3K2A",
  manageUrl: "https://example.com/booking/123?token=abc",
  cancelUrl: "https://example.com/booking/123/cancel?token=abc",
  businessName: "James Cars",
  contactPhone: "+971 50 123 4567",
} satisfies BookingConfirmationProps;
