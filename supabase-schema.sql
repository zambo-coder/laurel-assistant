-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Brand profile (one per user)
create table if not exists brand_profile (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  business_name text not null default '',
  tagline text default '',
  target_clients text default '',
  design_style text default '',
  services_pricing text default '',
  business_goals text default '',
  instagram_handle text default '',
  languages text[] default array['Spanish','English','Danish'],
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

-- Caption history
create table if not exists caption_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  prompt text not null,
  captions jsonb not null default '[]',
  created_at timestamptz default now()
);

-- Content calendar (one per month)
create table if not exists content_calendar (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  month_year text not null,
  days jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, month_year)
);

-- Time logs (ROI tracker)
create table if not exists time_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  activity_type text not null,
  hours_spent decimal(5,2) not null,
  log_date date not null default current_date,
  notes text,
  created_at timestamptz default now()
);

-- Outcome logs (ROI tracker)
create table if not exists outcome_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  channel text not null,
  inquiries integer default 0,
  conversions integer default 0,
  revenue decimal(10,2) default 0,
  log_date date not null default current_date,
  created_at timestamptz default now()
);

-- Strategy plans
create table if not exists strategy_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  brain_dump text,
  generated_plan jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Campaigns
create table if not exists campaigns (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  goal text not null,
  plan jsonb,
  created_at timestamptz default now()
);

-- Website copy history
create table if not exists website_copy (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  description text not null,
  language text not null default 'English',
  generated_copy text,
  created_at timestamptz default now()
);

-- Client inquiries
create table if not exists client_inquiries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  inquiry text not null,
  response text,
  service_suggestion text,
  flags jsonb default '[]',
  created_at timestamptz default now()
);

-- Asset library
create table if not exists assets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  tags text[] default '{}',
  file_path text not null,
  file_name text not null,
  file_type text not null,
  file_size bigint,
  created_at timestamptz default now()
);

-- Chat message history (optional persistence)
create table if not exists chat_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- Row Level Security — users can only see their own data
alter table brand_profile enable row level security;
alter table caption_history enable row level security;
alter table content_calendar enable row level security;
alter table time_logs enable row level security;
alter table outcome_logs enable row level security;
alter table strategy_plans enable row level security;
alter table campaigns enable row level security;
alter table website_copy enable row level security;
alter table client_inquiries enable row level security;
alter table assets enable row level security;
alter table chat_messages enable row level security;

-- RLS policies (repeat pattern for each table)
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'brand_profile','caption_history','content_calendar',
    'time_logs','outcome_logs','strategy_plans','campaigns',
    'website_copy','client_inquiries','assets','chat_messages'
  ] loop
    execute format(
      'create policy "Users see own data" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      tbl
    );
  end loop;
end;
$$;

-- Supabase Storage bucket for assets
insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict do nothing;

-- Storage policy: user can only access their own folder
create policy "Users manage own assets"
  on storage.objects for all
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
