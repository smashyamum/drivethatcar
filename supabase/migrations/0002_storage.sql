-- Car Booking CRM — storage bucket for car photos
-- Public-read bucket; paths use unguessable UUIDs so listings don't enumerate.

insert into storage.buckets (id, name, public)
values ('car-photos', 'car-photos', true)
on conflict (id) do nothing;

-- Anyone can read (public bucket)
create policy "anon read car-photos"
  on storage.objects for select
  to anon
  using (bucket_id = 'car-photos');

create policy "authed read car-photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'car-photos');

-- Authenticated users (admin) can upload, update, delete
create policy "authed upload car-photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'car-photos');

create policy "authed update car-photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'car-photos');

create policy "authed delete car-photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'car-photos');
