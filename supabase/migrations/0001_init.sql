-- Car Booking CRM — initial schema
-- M1: cars + car_photos
-- Later milestones add: customers, bookings, blocked_slots, settings, oauth_tokens, email_log

create extension if not exists "pgcrypto";

-- ============================================================================
-- updated_at trigger helper
-- ============================================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================================
-- cars
-- ============================================================================
create table cars (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  make text not null,
  model text not null,
  year int not null check (year between 1900 and 2100),
  variant text,
  mileage int check (mileage >= 0),
  price_pence int not null check (price_pence >= 0),
  colour text,
  transmission text check (transmission in ('manual','automatic','semi_auto')),
  fuel_type text check (fuel_type in ('petrol','diesel','hybrid','phev','electric')),
  body_type text check (body_type in ('hatchback','saloon','estate','suv','coupe','convertible','mpv','pickup')),
  registration text,
  description text,
  status text not null default 'available' check (status in ('available','sold','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cars_status_idx on cars(status);
create index cars_created_at_idx on cars(created_at desc);

create trigger cars_set_updated_at
  before update on cars
  for each row execute function set_updated_at();

-- ============================================================================
-- car_photos
-- ============================================================================
create table car_photos (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references cars(id) on delete cascade,
  storage_path text not null,
  alt text,
  position int not null default 0,
  is_primary boolean not null default false,
  width int,
  height int,
  created_at timestamptz not null default now()
);

create index car_photos_car_id_position_idx on car_photos(car_id, position);
create unique index car_photos_one_primary_per_car
  on car_photos(car_id) where is_primary = true;

-- ============================================================================
-- Row-level security
-- ============================================================================
alter table cars enable row level security;
alter table car_photos enable row level security;

-- Public (anon) can SELECT only available cars
create policy "anon reads available cars"
  on cars for select
  to anon
  using (status = 'available');

create policy "anon reads photos of available cars"
  on car_photos for select
  to anon
  using (exists (select 1 from cars where cars.id = car_photos.car_id and cars.status = 'available'));

-- Authenticated users (admin) get full access on these tables
create policy "authed full access on cars"
  on cars for all
  to authenticated
  using (true)
  with check (true);

create policy "authed full access on car_photos"
  on car_photos for all
  to authenticated
  using (true)
  with check (true);

-- service_role bypasses RLS by default; no explicit policy needed.
