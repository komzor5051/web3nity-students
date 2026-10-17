-- Курс AI-ассистентов: проекты классифицируются по назначению, а не по типу инструмента.
alter table public.vibe_works add column if not exists purpose text;
alter table public.vibe_works drop constraint if exists vibe_works_purpose_check;
alter table public.vibe_works add constraint vibe_works_purpose_check
  check (purpose is null or purpose in ('sales','support','booking','content','data','learning','personal','other'));
