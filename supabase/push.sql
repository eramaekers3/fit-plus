-- fit+ notifications. Safe to run more than once.
-- Run it in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- First replace {{FIT_URL}} with fit+'s address (https://fit-plus-sage.vercel.app) and {{FIT_CRON_SECRET}}
-- with the CRON_SECRET set on the fit-plus project in Vercel.
--
-- push_subscriptions and push_log come from lifestyle+ (its supabase/push.sql); all three apps
-- share them, and each phone's row says which app it's for.

create table if not exists public.push_subscriptions (
  endpoint    text primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  p256dh      text not null,
  auth        text not null,
  tz          text not null default 'America/Chicago',
  user_agent  text,
  updated_at  timestamptz not null default now()
);
alter table public.push_subscriptions add column if not exists app text not null default 'lifestyle';
create index if not exists push_subscriptions_app_user on public.push_subscriptions (app, user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "Own push subscriptions" on public.push_subscriptions;
create policy "Own push subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.push_log (
  user_id  uuid not null references auth.users on delete cascade,
  key      text not null,
  sent_at  timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.push_log enable row level security;

-- One-off timers set by the phone (the rest timer), sent by the server when they're up.
create table if not exists public.push_timers (
  user_id  uuid not null default auth.uid() references auth.users on delete cascade,
  app      text not null,
  key      text not null,
  fire_at  timestamptz not null,
  title    text not null,
  body     text not null default '',
  url      text not null default '/',
  primary key (user_id, app, key)
);
create index if not exists push_timers_due on public.push_timers (app, fire_at);
alter table public.push_timers enable row level security;
drop policy if exists "Own push timers" on public.push_timers;
create policy "Own push timers" on public.push_timers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Every minute: lift-day, stretch, weigh-in and zone 2 reminders.
select cron.schedule(
  'fit-push-tick',
  '* * * * *',
  $cron$
    select net.http_post(
      url := '{{FIT_URL}}/api/push-tick',
      headers := jsonb_build_object('Authorization', 'Bearer {{FIT_CRON_SECRET}}', 'Content-Type', 'application/json'),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $cron$
);

-- Every 5 seconds: if a rest timer is up, ask fit+ to send it. Nothing is called otherwise.
select cron.schedule(
  'fit-push-timers',
  '5 seconds',
  $cron$
    select net.http_post(
      url := '{{FIT_URL}}/api/push-timers',
      headers := jsonb_build_object('Authorization', 'Bearer {{FIT_CRON_SECRET}}', 'Content-Type', 'application/json'),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    )
    where exists (select 1 from public.push_timers where app = 'fit' and fire_at <= now() + interval '2 seconds');
  $cron$
);
