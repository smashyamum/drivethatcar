// Manually maintained types for the database schema.
// In M6 we'll switch to `supabase gen types typescript` and generate these.

export type CarStatus = "available" | "sold" | "hidden";
export type Transmission = "manual" | "automatic" | "semi_auto";
export type FuelType = "petrol" | "diesel" | "hybrid" | "phev" | "electric";
export type BodyType =
  | "hatchback"
  | "saloon"
  | "estate"
  | "suv"
  | "coupe"
  | "convertible"
  | "mpv"
  | "pickup";

export type Car = {
  id: string;
  slug: string;
  make: string;
  model: string;
  year: number;
  variant: string | null;
  mileage: number | null;
  price_pence: number;
  colour: string | null;
  transmission: Transmission | null;
  fuel_type: FuelType | null;
  body_type: BodyType | null;
  registration: string | null;
  description: string | null;
  status: CarStatus;
  created_at: string;
  updated_at: string;
};

export type CarPhoto = {
  id: string;
  car_id: string;
  storage_path: string;
  alt: string | null;
  position: number;
  is_primary: boolean;
  width: number | null;
  height: number | null;
  created_at: string;
};

export type LeadStatus =
  | "new"
  | "contacted"
  | "warm"
  | "hot"
  | "test_driven"
  | "negotiating"
  | "sold"
  | "lost"
  | "cold";

export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "warm",
  "hot",
  "test_driven",
  "negotiating",
  "sold",
  "lost",
  "cold",
];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  warm: "Warm",
  hot: "Hot",
  test_driven: "Test driven",
  negotiating: "Negotiating",
  sold: "Sold",
  lost: "Lost",
  cold: "Cold",
};

export const LEAD_STATUS_TONE: Record<
  LeadStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  new: "neutral",
  contacted: "neutral",
  warm: "warning",
  hot: "danger",
  test_driven: "warning",
  negotiating: "warning",
  sold: "success",
  lost: "neutral",
  cold: "neutral",
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  lead_status: LeadStatus;
  lead_source: string | null;
  next_follow_up_at: string | null;
  interested_car_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerActivityKind =
  | "note"
  | "call"
  | "whatsapp_sent"
  | "email_sent"
  | "sms_sent"
  | "meeting"
  | "status_change"
  | "follow_up_set"
  | "lead_created";

export type CustomerActivity = {
  id: string;
  customer_id: string;
  kind: CustomerActivityKind;
  body: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
};

export type BookingType = "viewing" | "test_drive";
export type BookingStatus = "confirmed" | "cancelled" | "completed" | "no_show";

export type Booking = {
  id: string;
  reference: string;
  car_id: string;
  customer_id: string;
  type: BookingType;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  manage_token_hash: string;
  manage_token: string | null;
  google_event_id: string | null;
  reminder_offsets_sent: number[];
  cancelled_at: string | null;
  cancelled_by: "customer" | "admin" | "system" | null;
  created_at: string;
  updated_at: string;
};

export type BlockedSlot = {
  id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
  created_at: string;
};

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type WorkingWindow = { start: string; end: string };
export type WorkingHours = Record<Weekday, WorkingWindow[]>;

export type Settings = {
  id: 1;
  business_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  timezone: string;
  slot_duration_minutes: number;
  buffer_minutes: number;
  working_hours: WorkingHours;
  google_calendar_id: string | null;
  resend_from_email: string | null;
  reminder_offsets_hours: number[];
  updated_at: string;
};

export const REMINDER_OFFSET_PRESETS: Array<{ hours: number; label: string }> = [
  { hours: 168, label: "1 week before" },
  { hours: 72, label: "3 days before" },
  { hours: 48, label: "2 days before" },
  { hours: 24, label: "1 day before" },
];

export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};
