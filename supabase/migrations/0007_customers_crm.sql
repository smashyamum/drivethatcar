-- M6: turn customers into a lead/CRM tab
--   · Lead status pipeline + source + next-follow-up + interested car
--   · Activity timeline (notes, calls, WhatsApp/email sent, status changes)
--   · Backfill existing free-text notes into the activity log, then drop column

create type lead_status as enum (
  'new',
  'contacted',
  'warm',
  'hot',
  'test_driven',
  'negotiating',
  'sold',
  'lost',
  'cold'
);

alter table customers
  add column if not exists lead_status lead_status not null default 'new',
  add column if not exists lead_source text,
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists interested_car_id uuid references cars(id) on delete set null;

create index if not exists customers_lead_status_idx on customers(lead_status);
create index if not exists customers_next_follow_up_idx
  on customers(next_follow_up_at)
  where next_follow_up_at is not null;

create table if not exists customer_activities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  kind text not null check (
    kind in (
      'note',
      'call',
      'whatsapp_sent',
      'email_sent',
      'sms_sent',
      'meeting',
      'status_change',
      'follow_up_set',
      'lead_created'
    )
  ),
  body text,
  metadata jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists customer_activities_customer_idx
  on customer_activities(customer_id, created_at desc);

alter table customer_activities enable row level security;

create policy "authed full access on customer_activities"
  on customer_activities for all to authenticated
  using (true) with check (true);

-- Backfill existing free-text notes as a single 'note' activity, then drop.
insert into customer_activities (customer_id, kind, body, created_at)
  select id, 'note', notes, coalesce(updated_at, created_at)
  from customers
  where notes is not null and trim(notes) <> '';

alter table customers drop column if exists notes;
