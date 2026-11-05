-- Existing projects: run this once in Supabase SQL Editor before deploying comments.
begin;
create table if not exists public.shared_comments (
  id uuid primary key,
  post_id uuid not null references public.shared_posts(id) on delete cascade,
  member_id text not null references public.members(id),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists shared_comments_post_created
  on public.shared_comments(post_id, created_at, id);
alter table public.shared_comments enable row level security;
revoke all on public.shared_comments from anon, authenticated;
grant all on public.shared_comments to service_role;
commit;
