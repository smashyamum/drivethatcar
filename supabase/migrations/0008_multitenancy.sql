-- M7 PR 1: multi-tenant foundation
--
-- Adds organisations, memberships, invitations.
-- Backfills the existing dealer's data into a single org and gives
-- the existing user an Owner membership.
-- Adds organization_id to every tenant table (with a default that
-- points at the lone org, so app code that hasn't been updated yet
-- keeps writing valid rows). PR 2 will start filtering by org in
-- queries; PR 3+ moves public pages under /d/<slug>.
-- Adds assigned_to to customers + bookings (used by the Sales role
-- in PR 5; nullable for now).
-- Rewrites RLS to be membership-aware.

-- ============================================================================
-- Tenancy tables
-- ============================================================================

create table organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  plan text not null default 'trial' check (plan in ('trial', 'active', 'suspended')),
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on organizations
  for each row execute function set_updated_at();

create table memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'sales')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index memberships_user_id_idx on memberships(user_id);
create index memberships_organization_id_idx on memberships(organization_id);

create table org_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'sales')),
  token_hash text not null,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index org_invitations_organization_id_idx on org_invitations(organization_id);
create index org_invitations_email_idx on org_invitations(email);
create unique index org_invitations_token_hash_idx on org_invitations(token_hash);

alter table organizations enable row level security;
alter table memberships enable row level security;
alter table org_invitations enable row level security;

-- ============================================================================
-- Helper: current user's role in a given org. SECURITY DEFINER so the
-- RLS policies on tenant tables can call it without recursing into
-- memberships' own RLS.
-- ============================================================================

create or replace function auth_user_org_role(org_id uuid)
  returns text
  language sql
  security definer
  stable
  set search_path = public
as $$
  select role from memberships
   where user_id = auth.uid() and organization_id = org_id
   limit 1;
$$;

-- Used as a column default so existing INSERTs (that don't yet set
-- organization_id) get the live dealer's org. Stays valid until PR 2
-- updates every server action to set organization_id explicitly, at
-- which point we drop the default.
create or replace function default_organization_id() returns uuid
  language sql stable as $$
  select id from organizations order by created_at asc limit 1;
$$;

-- ============================================================================
-- Backfill: create the org for the live dealer + Owner membership
--
-- Picks the earliest auth.users row as the original owner. If you have
-- test/secondary auth users, edit before running.
-- ============================================================================

insert into organizations (slug, name)
  select 'drivethatcar', coalesce(business_name, 'Drive That Car')
  from settings
  where id = 1;

insert into memberships (organization_id, user_id, role)
  select
    (select id from organizations where slug = 'drivethatcar'),
    u.id,
    'owner'
  from auth.users u
  order by u.created_at asc
  limit 1;

-- ============================================================================
-- Add organization_id to tenant tables
-- ============================================================================

alter table cars
  add column organization_id uuid not null
    default default_organization_id()
    references organizations(id) on delete cascade;
create index cars_organization_id_idx on cars(organization_id);

-- Replace global slug uniqueness with per-org uniqueness
alter table cars drop constraint cars_slug_key;
create unique index cars_organization_id_slug_key on cars(organization_id, slug);

alter table customers
  add column organization_id uuid not null
    default default_organization_id()
    references organizations(id) on delete cascade,
  add column assigned_to uuid references auth.users(id) on delete set null;
create index customers_organization_id_idx on customers(organization_id);
create index customers_assigned_to_idx on customers(assigned_to);

drop index if exists customers_phone_email_idx;
create unique index customers_organization_id_phone_email_idx
  on customers(organization_id, phone, email);

alter table bookings
  add column organization_id uuid not null
    default default_organization_id()
    references organizations(id) on delete cascade,
  add column assigned_to uuid references auth.users(id) on delete set null;
create index bookings_organization_id_idx on bookings(organization_id);
create index bookings_assigned_to_idx on bookings(assigned_to);

alter table bookings drop constraint bookings_reference_key;
create unique index bookings_organization_id_reference_key
  on bookings(organization_id, reference);

alter table customer_activities
  add column organization_id uuid not null
    default default_organization_id()
    references organizations(id) on delete cascade;
create index customer_activities_organization_id_idx on customer_activities(organization_id);

alter table blocked_slots
  add column organization_id uuid not null
    default default_organization_id()
    references organizations(id) on delete cascade;
create index blocked_slots_organization_id_idx on blocked_slots(organization_id);

alter table email_log
  add column organization_id uuid not null
    default default_organization_id()
    references organizations(id) on delete cascade;
create index email_log_organization_id_idx on email_log(organization_id);

-- Settings: was a singleton (id=1). Keep id around so existing queries
-- (.eq("id", 1)) still work in PR 1; PR 2 swaps queries to organization_id.
-- Switch id to a sequence so additional rows can exist for new orgs.
alter table settings
  add column organization_id uuid not null
    default default_organization_id()
    references organizations(id) on delete cascade;
create unique index settings_organization_id_key on settings(organization_id);

alter table settings drop constraint settings_id_check;
create sequence settings_id_seq as smallint owned by settings.id;
alter table settings alter column id set default nextval('settings_id_seq');
select setval('settings_id_seq', greatest(coalesce((select max(id) from settings), 0), 1) + 1);

-- ============================================================================
-- RLS on the new tables
-- ============================================================================

create policy "members read their organizations"
  on organizations for select to authenticated
  using (
    exists (
      select 1 from memberships m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
    )
  );

create policy "owners and admins update their organization"
  on organizations for update to authenticated
  using (auth_user_org_role(id) in ('owner', 'admin'))
  with check (auth_user_org_role(id) in ('owner', 'admin'));

create policy "members read memberships in their orgs"
  on memberships for select to authenticated
  using (
    user_id = auth.uid()
    OR auth_user_org_role(organization_id) in ('owner', 'admin')
  );

create policy "owners and admins manage memberships"
  on memberships for insert to authenticated
  with check (auth_user_org_role(organization_id) in ('owner', 'admin'));

create policy "owners and admins update memberships"
  on memberships for update to authenticated
  using (auth_user_org_role(organization_id) in ('owner', 'admin'))
  with check (auth_user_org_role(organization_id) in ('owner', 'admin'));

create policy "owners and admins delete memberships"
  on memberships for delete to authenticated
  using (auth_user_org_role(organization_id) in ('owner', 'admin'));

create policy "owners and admins manage invitations"
  on org_invitations for all to authenticated
  using (auth_user_org_role(organization_id) in ('owner', 'admin'))
  with check (auth_user_org_role(organization_id) in ('owner', 'admin'));

-- ============================================================================
-- Replace permissive RLS on existing tenant tables with membership checks
-- ============================================================================

drop policy if exists "authed full access on cars" on cars;
create policy "org members on cars (read)"
  on cars for select to authenticated
  using (auth_user_org_role(organization_id) is not null);
create policy "org members on cars (insert)"
  on cars for insert to authenticated
  with check (auth_user_org_role(organization_id) in ('owner', 'admin'));
create policy "org members on cars (update)"
  on cars for update to authenticated
  using (auth_user_org_role(organization_id) in ('owner', 'admin'))
  with check (auth_user_org_role(organization_id) in ('owner', 'admin'));
create policy "org members on cars (delete)"
  on cars for delete to authenticated
  using (auth_user_org_role(organization_id) in ('owner', 'admin'));

-- car_photos has no organization_id; gate via cars join.
drop policy if exists "authed full access on car_photos" on car_photos;
create policy "org members on car_photos"
  on car_photos for all to authenticated
  using (
    exists (
      select 1 from cars c
      where c.id = car_photos.car_id
        and auth_user_org_role(c.organization_id) is not null
    )
  )
  with check (
    exists (
      select 1 from cars c
      where c.id = car_photos.car_id
        and auth_user_org_role(c.organization_id) in ('owner', 'admin')
    )
  );

drop policy if exists "authed full access on customers" on customers;
-- Sales sees rows assigned to them or unassigned (so they can claim leads).
-- Owner/Admin see everything in the org.
create policy "org members on customers (read)"
  on customers for select to authenticated
  using (
    auth_user_org_role(organization_id) in ('owner', 'admin')
    OR (
      auth_user_org_role(organization_id) = 'sales'
      AND (assigned_to = auth.uid() OR assigned_to is null)
    )
  );
create policy "org members on customers (insert)"
  on customers for insert to authenticated
  with check (auth_user_org_role(organization_id) is not null);
create policy "org members on customers (update)"
  on customers for update to authenticated
  using (
    auth_user_org_role(organization_id) in ('owner', 'admin')
    OR (auth_user_org_role(organization_id) = 'sales' AND assigned_to = auth.uid())
  )
  with check (
    auth_user_org_role(organization_id) in ('owner', 'admin')
    OR (auth_user_org_role(organization_id) = 'sales' AND assigned_to = auth.uid())
  );
create policy "org members on customers (delete)"
  on customers for delete to authenticated
  using (auth_user_org_role(organization_id) in ('owner', 'admin'));

drop policy if exists "authed full access on bookings" on bookings;
create policy "org members on bookings (read)"
  on bookings for select to authenticated
  using (
    auth_user_org_role(organization_id) in ('owner', 'admin')
    OR (
      auth_user_org_role(organization_id) = 'sales'
      AND (assigned_to = auth.uid() OR assigned_to is null)
    )
  );
create policy "org members on bookings (insert)"
  on bookings for insert to authenticated
  with check (auth_user_org_role(organization_id) is not null);
create policy "org members on bookings (update)"
  on bookings for update to authenticated
  using (
    auth_user_org_role(organization_id) in ('owner', 'admin')
    OR (auth_user_org_role(organization_id) = 'sales' AND assigned_to = auth.uid())
  )
  with check (
    auth_user_org_role(organization_id) in ('owner', 'admin')
    OR (auth_user_org_role(organization_id) = 'sales' AND assigned_to = auth.uid())
  );
create policy "org members on bookings (delete)"
  on bookings for delete to authenticated
  using (auth_user_org_role(organization_id) in ('owner', 'admin'));

drop policy if exists "authed full access on blocked_slots" on blocked_slots;
create policy "org members on blocked_slots"
  on blocked_slots for all to authenticated
  using (auth_user_org_role(organization_id) is not null)
  with check (auth_user_org_role(organization_id) in ('owner', 'admin'));

drop policy if exists "authed full access on settings" on settings;
create policy "org members on settings (read)"
  on settings for select to authenticated
  using (auth_user_org_role(organization_id) is not null);
create policy "owners and admins update settings"
  on settings for update to authenticated
  using (auth_user_org_role(organization_id) in ('owner', 'admin'))
  with check (auth_user_org_role(organization_id) in ('owner', 'admin'));
create policy "owners and admins insert settings"
  on settings for insert to authenticated
  with check (auth_user_org_role(organization_id) in ('owner', 'admin'));

drop policy if exists "authed full access on customer_activities" on customer_activities;
-- Activity rows inherit visibility from the parent customer (sales row-scoping).
create policy "org members on customer_activities (read)"
  on customer_activities for select to authenticated
  using (
    exists (
      select 1 from customers c
      where c.id = customer_activities.customer_id
        and (
          auth_user_org_role(c.organization_id) in ('owner', 'admin')
          OR (
            auth_user_org_role(c.organization_id) = 'sales'
            AND (c.assigned_to = auth.uid() OR c.assigned_to is null)
          )
        )
    )
  );
create policy "org members on customer_activities (insert)"
  on customer_activities for insert to authenticated
  with check (auth_user_org_role(organization_id) is not null);
create policy "org members on customer_activities (delete)"
  on customer_activities for delete to authenticated
  using (auth_user_org_role(organization_id) in ('owner', 'admin'));

drop policy if exists "authed full access on email_log" on email_log;
create policy "org members on email_log"
  on email_log for select to authenticated
  using (auth_user_org_role(organization_id) is not null);
-- email_log inserts come from the service role (booking emails) which
-- bypasses RLS, so no insert policy is needed for authenticated.

-- Anon read policies on cars / car_photos / settings / blocked_slots stay
-- as-is — the public booking flow filters by car_id / org explicitly in
-- queries, and these tables are read-only to anon.
