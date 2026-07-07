-- Extend files table so recursively-synced Google Drive files become real,
-- locally-downloaded rows (backed by Supabase Storage) alongside local uploads.
alter table public.files
  add column source text not null default 'local' check (source in ('local', 'google_drive')),
  add column root_folder_id text,
  add column drive_file_id text,
  add column relative_path text not null default '',
  add column drive_modified_time timestamptz;

alter table public.files
  add constraint files_user_drive_file_unique unique (user_id, drive_file_id);

-- Cascade: removing a synced root folder removes its synced file rows automatically.
alter table public.files
  add constraint files_root_folder_fkey
  foreign key (user_id, root_folder_id)
  references public.google_drive_folders (user_id, folder_id)
  on delete cascade;

create index files_root_folder_idx on public.files (user_id, root_folder_id) where root_folder_id is not null;

-- Track sync progress/status per synced root folder.
alter table public.google_drive_folders
  add column sync_status text not null default 'idle' check (sync_status in ('idle', 'syncing', 'error')),
  add column sync_error text,
  add column last_synced_at timestamptz;
