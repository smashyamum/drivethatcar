import { createEvent, type EventAttributes } from "ics";

type BuildIcsInput = {
  uid: string;
  startUtc: Date;
  endUtc: Date;
  summary: string;
  description: string;
  location?: string;
  organiserName?: string;
  organiserEmail?: string;
  attendeeName: string;
  attendeeEmail: string;
  status?: "CONFIRMED" | "CANCELLED";
};

function utcArray(date: Date): [number, number, number, number, number] {
  return [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
  ];
}

export function buildIcs(input: BuildIcsInput): string {
  const event: EventAttributes = {
    uid: input.uid,
    start: utcArray(input.startUtc),
    startInputType: "utc",
    end: utcArray(input.endUtc),
    endInputType: "utc",
    title: input.summary,
    description: input.description,
    location: input.location,
    status: input.status ?? "CONFIRMED",
    organizer: input.organiserEmail
      ? { name: input.organiserName, email: input.organiserEmail }
      : undefined,
    attendees: [
      { name: input.attendeeName, email: input.attendeeEmail, rsvp: true, partstat: "ACCEPTED" },
    ],
    productId: "car-booking-crm",
  };

  const { error, value } = createEvent(event);
  if (error || !value) throw new Error(error?.message ?? "Could not build .ics");
  return value;
}
