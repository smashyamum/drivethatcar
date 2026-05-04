-- Car Booking CRM — bookings, customers, blocked slots, settings
-- M3: end-to-end booking flow (no email/calendar sync yet — those come in M4 + M5)

-- ============================================================================
-- customers (deduped by phone+email)
-- ============================================================================
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index customers_phone_email_idx on customers(phone, email);
create index customers_email_idx on customers(email);
create index customers_phone_idx on customers(phone);

create trigger customers_set_updated_at
  before update on customers
  for each row execute function set_updated_at();

-- ============================================================================
-- bookings
-- ============================================================================
create table bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  car_id uuid not null references cars(id) on delete restrict,
  customer_id uuid not null references customers(id) on delete restrict,
  type text not null check (type in ('viewing','test_drive')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'confirmed'
    check (status in ('confirmed','cancelled','completed','no_show')),
  manage_token_hash text not null,
  google_event_id text,
  reminder_sent_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by in ('customer','admin','system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Race-condition guard: only one confirmed booking per car at a given start time
create unique index bookings_no_double on bookings (car_id, start_at)
  where status = 'confirmed';

create index bookings_start_at_idx on bookings(start_at);
create index bookings_car_id_start_at_idx on bookings(car_id, start_at);
create index bookings_customer_id_idx on bookings(customer_id);
create index bookings_status_start_at_idx on bookings(status, start_at);

create trigger bookings_set_updated_at
  before update on bookings
  for each row execute function set_updated_at();

-- ============================================================================
-- blocked_slots (admin holidays / sick days / one-off blocks)
-- ============================================================================
create table blocked_slots (
  id uuid primary key default gen_random_uuid(),
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index blocked_slots_range_idx on blocked_slots(start_at, end_at);

-- ============================================================================
-- settings (singleton — exactly one row, id = 1)
-- ============================================================================
create table settings (
  id smallint primary key check (id = 1),
  business_name text,
  contact_email text,
  contact_phone text,
  timezone text not null default 'Asia/Dubai',
  slot_duration_minutes int not null default 60 check (slot_duration_minutes > 0),
  buffer_minutes int not null default 0 check (buffer_minutes >= 0),
  -- working_hours: per-weekday windows. Keys: mon, tue, wed, thu, fri, sat, sun.
  -- Each value is an array of {start, end} HH:mm windows (empty array = closed).
  working_hours jsonb not null default '{
    "mon": [{"start":"09:00","end":"19:00"}],
    "tue": [{"start":"09:00","end":"19:00"}],
    "wed": [{"start":"09:00","end":"19:00"}],
    "thu": [{"start":"09:00","end":"19:00"}],
    "fri": [],
    "sat": [{"start":"09:00","end":"19:00"}],
    "sun": [{"start":"09:00","end":"19:00"}]
  }'::jsonb,
  google_calendar_id text,
  resend_from_email text,
  updated_at timestamptz not null default now()
);

-- Seed the singleton row
insert into settings (id) values (1) on conflict (id) do nothing;

create trigger settings_set_updated_at
  before update on settings
  for each row execute function set_updated_at();

-- ============================================================================
-- Row-level security
-- ============================================================================
alter table customers enable row level security;
alter table bookings enable row level security;
alter table blocked_slots enable row level security;
alter table settings enable row level security;

-- Public booking flow needs INSERT on customers + bookings via service-role server actions.
-- We DON'T grant anon select on these tables (privacy: never expose customer/booking data publicly).
-- All public reads happen through the service-role server actions which bypass RLS.

-- Anon needs to read settings (for working hours when computing public slot availability)
create policy "anon reads settings"
  on settings for select
  to anon
  using (true);

create policy "anon reads blocked_slots"
  on blocked_slots for select
  to anon
  using (true);

-- Authenticated (admin) full access
create policy "authed full access on customers"
  on customers for all to authenticated
  using (true) with check (true);

create policy "authed full access on bookings"
  on bookings for all to authenticated
  using (true) with check (true);

create policy "authed full access on blocked_slots"
  on blocked_slots for all to authenticated
  using (true) with check (true);

create policy "authed full access on settings"
  on settings for all to authenticated
  using (true) with check (true);
