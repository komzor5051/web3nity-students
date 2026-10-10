-- Платформа закрыта для учеников + поля нового интерфейса (прототип 7–9 октября 2026).
-- Только добавления: существующие данные и ссылки не меняются.

-- 1. Кто считается учеником. Источник — участники чатов курса
--    (scripts/dump_members.py -> scripts/sync-members.ts). Организатор может
--    добавить человека вручную (source = 'manual') или закрыть доступ (revoked).
create table if not exists vibe_members (
  telegram_user_id bigint primary key,
  username text,
  display_name text,
  chats bigint[] not null default '{}',
  source text not null default 'chat',
  revoked boolean not null default false,
  added_at timestamptz not null default now()
);
alter table vibe_members enable row level security;

-- Вход человека не из списка: бот помечает токен, сайт показывает
-- «Доступ только для учеников».
alter table vibe_web_auth_tokens add column if not exists denied_at timestamptz;

-- 2. Анкета: несколько статусов и регион, который ученик правит сам.
alter table vibe_students add column if not exists statuses text[] not null default '{}';
alter table vibe_students add column if not exists region text;
-- «Для чего пришли на практикум и чего ожидаете» из формы знакомства.
alter table vibe_students add column if not exists expectations text;
update vibe_students set statuses = array[status]
  where status is not null and statuses = '{}';

-- 3. Проект: тип инструмента, состояние, необязательные поля, скрытие организатором.
alter table vibe_works add column if not exists kind text
  check (kind in ('site', 'bot', 'crm', 'other'));
alter table vibe_works add column if not exists stage text
  check (stage in ('in_progress', 'done'));
alter table vibe_works add column if not exists features text;
alter table vibe_works add column if not exists feedback_request text;
alter table vibe_works add column if not exists hidden_by_admin boolean not null default false;

-- 4. Данные больше не читаются анонимно: все запросы идут через сервер
--    после проверки сессии ученика.
drop policy if exists vibe_students_anon_read on vibe_students;
drop policy if exists vibe_works_anon_read on vibe_works;
drop policy if exists vibe_recommendations_anon_read on vibe_recommendations;
drop policy if exists vibe_tags_anon_read on vibe_tags;
