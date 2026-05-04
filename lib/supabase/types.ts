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

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
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
  reminder_sent_at: string | null;
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
  updated_at: string;
};

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
