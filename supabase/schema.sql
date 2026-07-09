-- Solvers Mission Control — live schema v1.4
-- Project: violetaAI

create extension if not exists "pgcrypto";

create table if not exists public.mc_status (
  id text primary key default 'default',
  handle text not null,
  phase text,
  objective_90d text,
  language_policy text,
  auto_post boolean default false,
  plan text,
  bio text,
  updated_at timestamptz default now()
);

create table if not exists public.mc_areas (
  id text primary key,
  code text not null,
  name text not null,
  description text,
  priority text check (priority in ('core','growth','support','side')),
  weekly_target int not null default 1,
  done_this_week int not null default 0
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
  score int default 0,
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

create table if not exists public.mc_metrics (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  followers int,
  following int,
  tweets int,
  likes int,
  posts_7d int,
  replies_7d int,
  impressions_7d int,
  engagements_7d int,
  profile_visits_7d int,
  dm_or_qualified_replies int,
  leads_high_ticket int,
  spark_followers jsonb default '[]'::jsonb,
  spark_engagement jsonb default '[]'::jsonb,
  spark_posts jsonb default '[]'::jsonb,
  raw jsonb default '{}'::jsonb
);

create table if not exists public.mc_schedule (
  id text primary key,
  when_label text not null,
  title text not null,
  status text not null default 'planned',
  channel text not null default 'X post',
  scheduled_for timestamptz,
  draft_id uuid references public.mc_drafts(id),
  created_at timestamptz not null default now()
);

create table if not exists public.mc_automations (
  id text primary key,
  name text not null,
  description text,
  enabled boolean not null default false,
  cadence text,
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_pipeline (
  id text primary key,
  label text not null,
  count int not null default 0,
  tone text not null default 'neutral',
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_calendar_days (
  id text primary key,
  day_label text not null,
  posts int not null default 0,
  replies int not null default 0,
  focus text,
  sort_order int not null default 0
);

-- RLS
alter table public.mc_status enable row level security;
alter table public.mc_areas enable row level security;
alter table public.mc_drafts enable row level security;
alter table public.mc_weekly_items enable row level security;
alter table public.mc_signals enable row level security;
alter table public.mc_metrics enable row level security;
alter table public.mc_schedule enable row level security;
alter table public.mc_automations enable row level security;
alter table public.mc_pipeline enable row level security;
alter table public.mc_calendar_days enable row level security;

do $$ begin create policy mc_status_read on public.mc_status for select using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy mc_areas_read on public.mc_areas for select using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy mc_drafts_read on public.mc_drafts for select using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy mc_weekly_read on public.mc_weekly_items for select using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy mc_signals_read on public.mc_signals for select using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy mc_metrics_read on public.mc_metrics for select using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy mc_schedule_read on public.mc_schedule for select using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy mc_automations_read on public.mc_automations for select using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy mc_pipeline_read on public.mc_pipeline for select using (true); exception when duplicate_object then null; end $$;
do $$ begin create policy mc_calendar_read on public.mc_calendar_days for select using (true); exception when duplicate_object then null; end $$;

-- demo approve from browser (tighten with auth later)
do $$ begin create policy mc_drafts_update on public.mc_drafts for update using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy mc_automations_update on public.mc_automations for update using (true) with check (true); exception when duplicate_object then null; end $$;
