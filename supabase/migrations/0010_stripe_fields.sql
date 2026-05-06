-- Stripe billing fields on organizations.
--
-- stripe_customer_id      = Stripe customer (cus_...) — created on first checkout
-- stripe_subscription_id  = Stripe subscription (sub_...) — set when paid plan starts
-- subscription_status     = mirror of Stripe subscription.status (active, past_due, canceled, ...)
-- current_period_end      = subscription's current period end — used for "next billing date" UI

alter table organizations add column if not exists stripe_customer_id text;
alter table organizations add column if not exists stripe_subscription_id text;
alter table organizations add column if not exists subscription_status text;
alter table organizations add column if not exists current_period_end timestamptz;

-- Index for fast lookup from webhooks (we receive customer_id and need the org).
create index if not exists organizations_stripe_customer_id_idx
  on organizations (stripe_customer_id);
