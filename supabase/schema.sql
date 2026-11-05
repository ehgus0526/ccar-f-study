-- Apply once to the dedicated study project's SQL editor, or through Supabase MCP.
begin;
create table if not exists public.members (
  id text primary key check (id in ('dohyeon','yeeun','jieun')),
  name text not null unique, color text not null, password_hash text not null
);
create table if not exists public.sessions (
  token_hash text primary key, member_id text not null references public.members(id), expires_at timestamptz not null
);
create table if not exists public.login_attempts (
  id uuid primary key, identifier text not null, attempted_at timestamptz not null
);
create index if not exists login_attempts_lookup on public.login_attempts(identifier, attempted_at);
create table if not exists public.todos (
  id uuid primary key, member_id text not null references public.members(id), curriculum_id text,
  title text not null check (char_length(title) between 1 and 120),
  date date not null, completed_at timestamptz, note text not null default '' check (char_length(note) <= 2000),
  photo_key text, created_at timestamptz not null, batch_id uuid not null,
  unique(member_id, batch_id, date)
);
create index if not exists todos_date on public.todos(date);
create table if not exists public.shared_posts (
  id uuid primary key, member_id text not null references public.members(id),
  body text not null check (char_length(body) between 1 and 4000), url text not null default '' check (char_length(url) <= 2000),
  photo_key text,
  created_at timestamptz not null, updated_at timestamptz not null
);
create table if not exists public.shared_comments (
  id uuid primary key, post_id uuid not null references public.shared_posts(id) on delete cascade,
  member_id text not null references public.members(id),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null, updated_at timestamptz not null
);
create index if not exists shared_comments_post_created on public.shared_comments(post_id, created_at, id);
alter table public.members enable row level security;
alter table public.sessions enable row level security;
alter table public.login_attempts enable row level security;
alter table public.todos enable row level security;
alter table public.shared_posts enable row level security;
alter table public.shared_comments enable row level security;
-- Custom app sessions are validated by Next.js. No browser role can read these tables.
revoke all on public.members, public.sessions, public.login_attempts, public.todos, public.shared_posts, public.shared_comments from anon, authenticated;
grant all on public.members, public.sessions, public.login_attempts, public.todos, public.shared_posts, public.shared_comments to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('proofs','proofs',false,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
commit;
