create extension if not exists pgcrypto;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  name text null check (name is null or char_length(name) <= 40),
  content text not null check (char_length(trim(content)) between 2 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- Default architecture: all reads/writes go through the Node.js API using
-- the server-only service role key. Do not expose that key in the browser.
-- No public table policies are created intentionally.
