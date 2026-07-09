-- Solvers Mission Control — v1 schema
-- Project: violetaAI

create extension if not exists "pgcrypto";

create table if not exists public.mc_status (
  id text primary key default 'default',
  handle text not null,
  phase text,
  objective_90d text,
  language_policy text,
  auto_post boolean default false,
  updated_at timestamptz default now()
);

create table if not exists public.mc_areas (
  id text primary key,
  code text not null,
  name text not null,
  description text,
  priority text check (priority in ('core','growth','side')),
  weekly_target text
);

create table if not exists public.mc_drafts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  area text,
  status text not null default 'pending'
    check (status in ('pending','approved','posted','rejected')),
  language text default 'ES',
  preview text,
  body text,
  source text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.mc_weekly_items (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  day_label text,
  item text not null,
  state text,
  created_at timestamptz default now()
);

create table if not exists public.mc_signals (
  id uuid primary key default gen_random_uuid(),
  creator_handle text,
  mechanism text,
  solvers_angle text,
  raw_ref text,
  created_at timestamptz default now()
);

-- RLS: lock down by default; service role / backend only for v1
alter table public.mc_status enable row level security;
alter table public.mc_areas enable row level security;
alter table public.mc_drafts enable row level security;
alter table public.mc_weekly_items enable row level security;
alter table public.mc_signals enable row level security;
