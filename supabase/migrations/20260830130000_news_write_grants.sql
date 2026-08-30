-- Allow authenticated admins to insert/update/delete news (RLS still applies)
grant insert, update, delete on public.news to authenticated;

-- Calendar CMS uses the same admin write pattern
grant insert, update, delete on public.calendar_data to authenticated;
