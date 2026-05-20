-- web3nity-students: рекомендации участников.
--
-- Заполняется батч-скриптом (scripts/recommend.ts) вручную раз в месяц —
-- один прогон LLM по всем профилям. Сайт только читает эту таблицу,
-- поэтому на просмотре страниц токены не тратятся.

create table if not exists recommendations (
  student_id     uuid not null references students(id) on delete cascade,
  recommended_id uuid not null references students(id) on delete cascade,
  reason         text,
  rank           int not null default 0,
  created_at     timestamptz not null default now(),
  primary key (student_id, recommended_id)
);

create index if not exists recommendations_student_idx
  on recommendations (student_id, rank);

-- Читается только server-side через service_role (как web_sessions).
alter table recommendations enable row level security;
