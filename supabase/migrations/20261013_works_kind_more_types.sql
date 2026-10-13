-- Типы проектов по тому, что ученики выкладывают в SHOW CASE и ХАКАТОН.
alter table public.vibe_works drop constraint vibe_works_kind_check;
alter table public.vibe_works add constraint vibe_works_kind_check
  check (kind = any (array['site','app','bot','agent','crm','automation','other']));
