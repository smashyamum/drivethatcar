-- Track exactly when a car / customer flipped to "sold" so analytics can
-- bucket by date range without false positives from updated_at moving on
-- unrelated edits.

alter table cars       add column if not exists sold_at timestamptz;
alter table customers  add column if not exists sold_at timestamptz;

-- Backfill best-guess from updated_at for rows already in the "sold" state.
update cars      set sold_at = updated_at where status      = 'sold' and sold_at is null;
update customers set sold_at = updated_at where lead_status = 'sold' and sold_at is null;

-- Indexes for the analytics queries (date-range scans).
create index if not exists cars_sold_at_idx      on cars      (organization_id, sold_at) where sold_at is not null;
create index if not exists customers_sold_at_idx on customers (organization_id, sold_at) where sold_at is not null;
