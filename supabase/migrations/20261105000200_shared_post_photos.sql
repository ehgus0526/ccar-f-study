-- Existing projects: run this once in Supabase SQL Editor before deploying post images.
begin;
alter table public.shared_posts add column if not exists photo_key text;
commit;
