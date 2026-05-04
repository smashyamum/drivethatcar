-- Car Booking CRM — email log (audit trail for transactional emails)

create table email_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete set null,
  template text not null check (template in ('confirmation','cancellation','reschedule','reminder')),
  to_email text not null,
  resend_id text,
  error text,
  sent_at timestamptz not null default now()
);

create index email_log_booking_id_idx on email_log(booking_id);
create index email_log_sent_at_idx on email_log(sent_at desc);

alter table email_log enable row level security;

create policy "authed full access on email_log"
  on email_log for all to authenticated
  using (true) with check (true);
