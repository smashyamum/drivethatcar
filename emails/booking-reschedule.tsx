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

export type BookingRescheduleProps = {
  customerName: string;
  carHeadline: string;
  oldWhenLabel: string;
  newWhenLabel: string;
  typeLabel: string;
  reference: string;
  manageUrl: string;
  cancelUrl: string;
  businessName: string;
};

export default function BookingReschedule({
  customerName,
  carHeadline,
  oldWhenLabel,
  newWhenLabel,
  typeLabel,
  reference,
  manageUrl,
  cancelUrl,
  businessName,
}: BookingRescheduleProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Your ${typeLabel.toLowerCase()} has moved to ${newWhenLabel}`}</Preview>
      <Tailwind>
        <Body className="bg-[#f8f9fa] font-sans text-[#374151]">
          <Container className="mx-auto my-10 max-w-[560px] rounded-[12px] border border-[#e5e7eb] bg-white p-10">
            <Text className="m-0 mb-1 text-xs font-semibold uppercase tracking-wide text-[#f59e0b]">
              Rescheduled
            </Text>
            <Text className="m-0 mb-2 text-[28px] font-semibold tracking-tight text-[#111111]">
              New time confirmed
            </Text>
            <Text className="m-0 mb-8 text-base text-[#6b7280]">
              Hi {customerName.split(" ")[0]}, your booking has been moved. An updated calendar
              invite is attached.
            </Text>

            <Section className="rounded-[12px] border border-[#e5e7eb] bg-[#f8f9fa] p-5">
              <Section className="mb-3">
                <Text className="m-0 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                  Was
                </Text>
                <Text className="m-0 mt-0.5 text-sm font-medium text-[#6b7280] line-through">
                  {oldWhenLabel}
                </Text>
              </Section>
              <Section className="mb-3">
                <Text className="m-0 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
                  Now
                </Text>
                <Text className="m-0 mt-0.5 text-sm font-semibold text-[#111111]">
                  {newWhenLabel}
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
            <Text className="m-0 text-center text-xs text-[#898989]">{businessName}</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

BookingReschedule.PreviewProps = {
  customerName: "Sara Khan",
  carHeadline: "2022 BMW 320d M Sport",
  oldWhenLabel: "Sat 10 May 2026 at 14:00",
  newWhenLabel: "Mon 12 May 2026 at 10:00",
  typeLabel: "Viewing",
  reference: "BK-7H3K2A",
  manageUrl: "https://example.com/booking/123?token=abc",
  cancelUrl: "https://example.com/booking/123/cancel?token=abc",
  businessName: "James Cars",
} satisfies BookingRescheduleProps;
