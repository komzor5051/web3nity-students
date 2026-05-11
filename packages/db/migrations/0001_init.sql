-- web3nity-students: initial schema
-- Spec: docs/superpowers/specs/2026-05-08-web3nity-students-platform-design.md

create extension if not exists "pgcrypto";

-- =========================
-- students
-- =========================
create table if not exists students (
  id                 uuid primary key default gen_random_uuid(),
  -- Nullable: HTML-выгрузка не содержит tg_id. Бот заполнит при первой live-встрече.
  telegram_user_id   bigint unique,
  telegram_username  text,
  display_name       text not null,
  avatar_url         text,
  city               text,
  country            text,
  niche              text,
  bio                text,
  goal               text,
  expertise          text,
  hobbies            text,
  age                int,
  status             text check (status in ('looking_for_clients','looking_for_partners','just_learning') or status is null),
  is_published       boolean not null default true,
  cohort             text not null default 'AI-Ассистенты 3.0',
  source_message_id  text,
  -- import_key: нормализованное имя автора из HTML-экспорта (lowercase, trimmed).
  -- Используется как natural key пока telegram_user_id не известен.
  import_key         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index if not exists students_cohort_import_key_uniq
  on students (cohort, import_key)
  where import_key is not null;

create index if not exists students_is_published_idx on students (is_published) where is_published;
create index if not exists students_country_idx on students (country);
create index if not exists students_niche_idx on students (niche);

-- =========================
-- works
-- =========================
create table if not exists works (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references students(id) on delete cascade,
  title              text not null,
  description        text,
  media              jsonb not null default '[]'::jsonb,
  tags               text[] not null default '{}',
  source_message_id  text,
  posted_at          timestamptz,
  is_published       boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index if not exists works_source_message_uniq
  on works (source_message_id)
  where source_message_id is not null;

create index if not exists works_student_idx on works (student_id);
create index if not exists works_published_idx on works (is_published) where is_published;

-- =========================
-- raw_messages (audit + reclassify)
-- =========================
create table if not exists raw_messages (
  id                 text primary key,            -- 'html:28' или 'tg:<chat>:<message_id>'
  thread_id          bigint,
  author_tg_id       bigint,
  author_name        text,
  text               text,
  media              jsonb,
  posted_at          timestamptz,
  classified_as      text check (classified_as in ('intro','work','qa','chat') or classified_as is null),
  processed_at       timestamptz,
  ingested_from      text not null check (ingested_from in ('html_export','bot_pull'))
);

create index if not exists raw_messages_author_idx on raw_messages (author_tg_id);
create index if not exists raw_messages_unprocessed_idx
  on raw_messages (ingested_from)
  where processed_at is null;

-- =========================
-- tags
-- =========================
create table if not exists tags (
  slug   text primary key,
  label  text not null,
  type   text not null check (type in ('niche','skill','work_category'))
);

-- =========================
-- bot_sessions
-- =========================
create table if not exists bot_sessions (
  telegram_user_id   bigint primary key,
  state              text,
  context            jsonb not null default '{}'::jsonb,
  updated_at         timestamptz not null default now()
);

-- =========================
-- updated_at triggers
-- =========================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_students_updated on students;
create trigger trg_students_updated before update on students
  for each row execute function set_updated_at();

drop trigger if exists trg_works_updated on works;
create trigger trg_works_updated before update on works
  for each row execute function set_updated_at();

-- =========================
-- RLS
-- =========================
alter table students      enable row level security;
alter table works         enable row level security;
alter table raw_messages  enable row level security;
alter table tags          enable row level security;
alter table bot_sessions  enable row level security;

-- Anon read: только опубликованное
drop policy if exists students_anon_read on students;
create policy students_anon_read on students
  for select to anon
  using (is_published = true);

drop policy if exists works_anon_read on works;
create policy works_anon_read on works
  for select to anon
  using (is_published = true);

drop policy if exists tags_anon_read on tags;
create policy tags_anon_read on tags
  for select to anon
  using (true);

-- raw_messages и bot_sessions: только service_role (политик нет = всё закрыто для anon)

-- =========================
-- storage buckets
-- =========================
insert into storage.buckets (id, name, public)
  values ('students-avatars', 'students-avatars', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('works-media', 'works-media', true)
  on conflict (id) do nothing;
