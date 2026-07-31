-- vibecoding-students: сборный файл миграций 0001-0005 с префиксом vibe_.
-- Нужен для разового применения полной схемы на общем проекте lvmn-hub,
-- где таблицы курса живут рядом с таблицами других проектов и должны
-- иметь свой префикс. Собран вручную из миграций packages/db/migrations/.
-- При добавлении новой миграции — дособрать этот файл заново.

create extension if not exists "pgcrypto";

-- =========================
-- 0001_init.sql
-- =========================

-- vibe_students
-- =========================
create table if not exists vibe_students (
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

create unique index if not exists vibe_students_cohort_import_key_uniq
  on vibe_students (cohort, import_key)
  where import_key is not null;

create index if not exists vibe_students_is_published_idx on vibe_students (is_published) where is_published;
create index if not exists vibe_students_country_idx on vibe_students (country);
create index if not exists vibe_students_niche_idx on vibe_students (niche);

-- vibe_works
-- =========================
create table if not exists vibe_works (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references vibe_students(id) on delete cascade,
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

create unique index if not exists vibe_works_source_message_uniq
  on vibe_works (source_message_id)
  where source_message_id is not null;

create index if not exists vibe_works_student_idx on vibe_works (student_id);
create index if not exists vibe_works_published_idx on vibe_works (is_published) where is_published;

-- vibe_raw_messages (audit + reclassify)
-- =========================
create table if not exists vibe_raw_messages (
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

create index if not exists vibe_raw_messages_author_idx on vibe_raw_messages (author_tg_id);
create index if not exists vibe_raw_messages_unprocessed_idx
  on vibe_raw_messages (ingested_from)
  where processed_at is null;

-- vibe_tags
-- =========================
create table if not exists vibe_tags (
  slug   text primary key,
  label  text not null,
  type   text not null check (type in ('niche','skill','work_category'))
);

-- vibe_bot_sessions
-- =========================
create table if not exists vibe_bot_sessions (
  telegram_user_id   bigint primary key,
  state              text,
  context            jsonb not null default '{}'::jsonb,
  updated_at         timestamptz not null default now()
);

-- updated_at triggers
-- =========================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_vibe_students_updated on vibe_students;
create trigger trg_vibe_students_updated before update on vibe_students
  for each row execute function set_updated_at();

drop trigger if exists trg_vibe_works_updated on vibe_works;
create trigger trg_vibe_works_updated before update on vibe_works
  for each row execute function set_updated_at();

-- RLS
-- =========================
alter table vibe_students      enable row level security;
alter table vibe_works         enable row level security;
alter table vibe_raw_messages  enable row level security;
alter table vibe_tags          enable row level security;
alter table vibe_bot_sessions  enable row level security;

-- Anon read: только опубликованное
drop policy if exists vibe_students_anon_read on vibe_students;
create policy vibe_students_anon_read on vibe_students
  for select to anon
  using (is_published = true);

drop policy if exists vibe_works_anon_read on vibe_works;
-- Работа читается анонимом, только если опубликована и она сама, и её автор:
-- иначе скрытый профиль продолжал бы светить своими карточками.
create policy vibe_works_anon_read on vibe_works
  for select to anon
  using (
    is_published = true
    and exists (
      select 1 from vibe_students s
      where s.id = vibe_works.student_id and s.is_published = true
    )
  );

drop policy if exists vibe_tags_anon_read on vibe_tags;
create policy vibe_tags_anon_read on vibe_tags
  for select to anon
  using (true);

-- vibe_raw_messages и vibe_bot_sessions: только service_role (политик нет = всё закрыто для anon)

-- storage buckets
-- =========================
insert into storage.buckets (id, name, public)
  values ('vibe-students-avatars', 'vibe-students-avatars', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('vibe-works-media', 'vibe-works-media', true)
  on conflict (id) do nothing;

-- =========================
-- 0002_web_auth.sql
-- =========================
-- web3nity-students: web auth via Telegram bot deep-link

-- vibe_web_auth_tokens
-- =========================
-- Одноразовый токен для логина через Telegram бот.
-- Жизненный цикл:
--   1. Web создаёт строку с token (anon) → даёт deep-link tg://...?start=auth_<token>
--   2. Юзер открывает бота → /start auth_<token> → бот заполняет telegram_user_id и student_id
--   3. Web опрашивает по token, видит confirmed_at → создаёт web_session, чистит токен.
create table if not exists vibe_web_auth_tokens (
  token              text primary key,
  telegram_user_id   bigint,
  student_id         uuid references vibe_students(id) on delete set null,
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null,
  confirmed_at       timestamptz
);

create index if not exists vibe_web_auth_tokens_expires_idx on vibe_web_auth_tokens (expires_at);

-- vibe_web_sessions
-- =========================
-- HTTP-only cookie session_id → student_id.
create table if not exists vibe_web_sessions (
  session_id         text primary key,
  student_id         uuid not null references vibe_students(id) on delete cascade,
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null
);

create index if not exists vibe_web_sessions_student_idx on vibe_web_sessions (student_id);
create index if not exists vibe_web_sessions_expires_idx on vibe_web_sessions (expires_at);

-- RLS
-- =========================
-- Обе таблицы используются только из server-side кода через service_role.
-- Никаких политик для anon — anon видеть их не должен.
alter table vibe_web_auth_tokens enable row level security;
alter table vibe_web_sessions    enable row level security;

-- =========================
-- 0003_recommendations.sql
-- =========================
-- web3nity-students: рекомендации участников.
--
-- Заполняется батч-скриптом (scripts/recommend.ts) вручную раз в месяц —
-- один прогон LLM по всем профилям. Сайт только читает эту таблицу,
-- поэтому на просмотре страниц токены не тратятся.

create table if not exists vibe_recommendations (
  student_id     uuid not null references vibe_students(id) on delete cascade,
  recommended_id uuid not null references vibe_students(id) on delete cascade,
  reason         text,
  rank           int not null default 0,
  created_at     timestamptz not null default now(),
  primary key (student_id, recommended_id)
);

create index if not exists vibe_recommendations_student_idx
  on vibe_recommendations (student_id, rank);

-- Читается только server-side через service_role (как web_sessions).
alter table vibe_recommendations enable row level security;

-- =========================
-- 0004_sphere.sql
-- =========================
-- web3nity-students: широкая сфера деятельности участника.
--
-- niche остаётся детальной (свободный текст из intro), а sphere — одна из
-- 5-7 канонических категорий (Маркетинг, Продажи, Разработка и т.п.).
-- Заполняется батч-скриптом scripts/spheres.ts. По sphere работает фильтр
-- на витрине: участник выбирает сферу и видит всех «коллег по цеху».

alter table vibe_students add column if not exists sphere text;

create index if not exists vibe_students_sphere_idx on vibe_students (sphere);

-- =========================
-- 0005_vibecoding.sql
-- =========================
-- vibecoding-students: дельта к схеме web3nity под курс по вайб-кодингу.
-- Работа здесь — цифровой продукт (живой сайт, репозиторий), а не текстовый кейс.

alter table vibe_works add column if not exists live_url          text;
alter table vibe_works add column if not exists repo_url          text;
alter table vibe_works add column if not exists screenshot_path   text;
alter table vibe_works add column if not exists screenshot_failed boolean not null default false;
alter table vibe_works add column if not exists stack             text[] not null default '{}';

create index if not exists vibe_works_live_url_idx on vibe_works (live_url) where live_url is not null;

-- Ветка форума, из которой пришло сообщение. Классификация делается по ней.
alter table vibe_raw_messages add column if not exists topic_id bigint;
create index if not exists vibe_raw_messages_topic_idx on vibe_raw_messages (topic_id);

-- Новый источник: живой дамп через Telethon.
alter table vibe_raw_messages drop constraint if exists vibe_raw_messages_ingested_from_check;
alter table vibe_raw_messages add constraint vibe_raw_messages_ingested_from_check
  check (ingested_from in ('html_export','bot_pull','telegram_live'));

-- Когорта = тариф курса.
alter table vibe_students alter column cohort set default 'vibecoding-main';

-- =========================
-- 0006_recommendations_read.sql
-- =========================
-- vibecoding-students: anon-чтение рекомендаций.
--
-- vibe_recommendations включил RLS в 0003, но без политики чтения для anon —
-- публичная страница ученика (/s/[slug]) читает эту таблицу анонимным
-- клиентом, поэтому секция «С кем познакомиться» была пустой всегда.
-- Разрешаем читать только строки, где и целевой, и рекомендованный ученик
-- опубликованы — иначе через прямой anon-запрос к таблице можно было бы
-- увидеть reason для неопубликованного профиля.

drop policy if exists vibe_recommendations_anon_read on vibe_recommendations;
create policy vibe_recommendations_anon_read on vibe_recommendations
  for select to anon
  using (
    exists (
      select 1 from vibe_students st
      where st.id = vibe_recommendations.student_id and st.is_published = true
    )
    and exists (
      select 1 from vibe_students sr
      where sr.id = vibe_recommendations.recommended_id and sr.is_published = true
    )
  );
