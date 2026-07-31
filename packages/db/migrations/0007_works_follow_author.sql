-- Работы не должны переживать скрытие профиля.
--
-- Прежняя политика смотрела только на works.is_published: ученик снимал
-- профиль с публикации, а его карточки работ оставались читаемы для anon
-- и продолжали отдавать имя, ссылки и описание.

drop policy if exists works_anon_read on works;
create policy works_anon_read on works
  for select to anon
  using (
    is_published = true
    and exists (
      select 1 from students s
      where s.id = works.student_id and s.is_published = true
    )
  );
