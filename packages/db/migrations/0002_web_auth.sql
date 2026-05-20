-- web3nity-students: web auth via Telegram bot deep-link

-- =========================
-- web_auth_tokens
-- =========================
-- Одноразовый токен для логина через Telegram бот.
-- Жизненный цикл:
--   1. Web создаёт строку с token (anon) → даёт deep-link tg://...?start=auth_<token>
--   2. Юзер открывает бота → /start auth_<token> → бот заполняет telegram_user_id и student_id
--   3. Web опрашивает по token, видит confirmed_at → создаёт web_session, чистит токен.
create table if not exists web_auth_tokens (
  token              text primary key,
  telegram_user_id   bigint,
  student_id         uuid references students(id) on delete set null,
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null,
  confirmed_at       timestamptz
);

create index if not exists web_auth_tokens_expires_idx on web_auth_tokens (expires_at);

-- =========================
-- web_sessions
-- =========================
-- HTTP-only cookie session_id → student_id.
create table if not exists web_sessions (
  session_id         text primary key,
  student_id         uuid not null references students(id) on delete cascade,
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null
);

create index if not exists web_sessions_student_idx on web_sessions (student_id);
create index if not exists web_sessions_expires_idx on web_sessions (expires_at);

-- =========================
-- RLS
-- =========================
-- Обе таблицы используются только из server-side кода через service_role.
-- Никаких политик для anon — anon видеть их не должен.
alter table web_auth_tokens enable row level security;
alter table web_sessions    enable row level security;
