-- M5.5: configurable, multi-reminder schedule
-- Replace single `reminder_sent_at` (one shot, fixed 24h) with:
--  · settings.reminder_offsets_hours — int[] of "hours before booking" the
--    user wants reminders fired at (e.g. {24} or {72,24})
--  · bookings.reminder_offsets_sent — int[] tracking which offsets have
--    already been emailed for that booking, so the daily cron is idempotent.

alter table settings
  add column if not exists reminder_offsets_hours int[] not null default array[24]::int[];

alter table bookings
  add column if not exists reminder_offsets_sent int[] not null default '{}'::int[];

-- Backfill: any booking that already had a reminder fired under the old
-- system has the 24h slot marked sent so we don't re-send it.
update bookings
  set reminder_offsets_sent = array[24]
  where reminder_sent_at is not null
    and (reminder_offsets_sent = '{}'::int[]);

-- Drop the old single-shot column and rebuild the cron index without
-- the `is null` predicate (the array check happens app-side now).
drop index if exists bookings_reminder_window_idx;
alter table bookings drop column if exists reminder_sent_at;

create index if not exists bookings_reminder_window_idx
  on bookings (start_at)
  where status = 'confirmed';
