-- 1. Add columns to audios table
ALTER TABLE public.audios 
ADD COLUMN IF NOT EXISTS play_count bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS download_count bigint DEFAULT 0;

-- 2. Create safely increment function (RPC)
-- This allows appropriate incrementing without giving users full UPDATE permission on the table
create or replace function increment_audio_stat(row_id bigint, stat_type text)
returns void
language plpgsql
security definer
as $$
begin
  if stat_type = 'play' then
    update public.audios
    set play_count = play_count + 1
    where id = row_id;
  elsif stat_type = 'download' then
    update public.audios
    set download_count = download_count + 1
    where id = row_id;
  end if;
end;
$$;
