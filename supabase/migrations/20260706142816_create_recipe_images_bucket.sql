
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

create policy "user owns recipe image files" on storage.objects
  for all using (bucket_id = 'recipe-images' and (auth.uid())::text = (storage.foldername(name))[1])
  with check (bucket_id = 'recipe-images' and (auth.uid())::text = (storage.foldername(name))[1]);
