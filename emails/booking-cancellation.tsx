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

export type BookingCancellationProps = {
  customerName: string;
  carHeadline: string;
  whenLabel: string;
  reference: string;
  rebookUrl: string;
  businessName: string;
};

export default function BookingCancellation({
  customerName,
  carHeadline,
  whenLabel,
  reference,
  rebookUrl,
  businessName,
}: BookingCancellationProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Your booking for the ${carHeadline} has been cancelled`}</Preview>
      <Tailwind>
        <Body className="bg-[#f8f9fa] font-sans text-[#374151]">
          <Container className="mx-auto my-10 max-w-[560px] rounded-[12px] border border-[#e5e7eb] bg-white p-10">
            <Text className="m-0 mb-1 text-xs font-semibold uppercase tracking-wide text-[#ef4444]">
              Cancelled
            </Text>
            <Text className="m-0 mb-2 text-[28px] font-semibold tracking-tight text-[#111111]">
              Booking cancelled
            </Text>
            <Text className="m-0 mb-8 text-base text-[#6b7280]">
              Hi {customerName.split(" ")[0]}, your booking has been cancelled. The slot is now
              free for someone else.
            </Text>

            <Section className="rounded-[12px] border border-[#e5e7eb] bg-[#f8f9fa] p-5">
              <Section className="mb-3">
                <Text className="m-0 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                  Was
                </Text>
                <Text className="m-0 mt-0.5 text-sm font-semibold text-[#111111]">
                  {whenLabel}
                </Text>
              </Section>
              <Section className="mb-3">
                <Text className="m-0 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                  Car
                </Text>
                <Text className="m-0 mt-0.5 text-sm font-semibold text-[#111111]">
                  {carHeadline}
                </Text>
              </Section>
              <Section>
                <Text className="m-0 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                  Reference
                </Text>
                <Text className="m-0 mt-0.5 font-mono text-sm font-semibold text-[#111111]">
                  {reference}
                </Text>
              </Section>
            </Section>

            <Section className="mt-6 text-center">
              <Link
                href={rebookUrl}
                className="inline-block rounded-md bg-[#111111] px-5 py-3 text-sm font-semibold text-white no-underline"
              >
                Book again
              </Link>
            </Section>

            <Hr className="my-8 border-[#e5e7eb]" />
            <Text className="m-0 text-center text-xs text-[#898989]">{businessName}</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

BookingCancellation.PreviewProps = {
  customerName: "Sara Khan",
  carHeadline: "2022 BMW 320d M Sport",
  whenLabel: "Sat 10 May 2026 at 14:00",
  reference: "BK-7H3K2A",
  rebookUrl: "https://example.com/cars",
  businessName: "James Cars",
} satisfies BookingCancellationProps;
