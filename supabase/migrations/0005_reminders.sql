-- M5: 24h reminder emails
-- 1) Track when each booking's reminder was sent (so we don't double-send).
-- 2) Store the manage token in plaintext so the reminder email can include
--    reschedule/cancel links. The hash is still used for verification on the
--    public manage pages (timing-safe compare).

alter table bookings
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists manage_token text;

-- Index for the cron query: confirmed + start_at in window + reminder not yet sent
create index if not exists bookings_reminder_window_idx
  on bookings (start_at)
  where status = 'confirmed' and reminder_sent_at is null;
