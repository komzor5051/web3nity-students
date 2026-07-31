-- vibecoding-students: anon-чтение рекомендаций.
--
-- 0003_recommendations.sql включил RLS на recommendations, но не добавил
-- политику чтения для anon — публичная страница ученика (/s/[slug]) читает
-- эту таблицу анонимным клиентом, поэтому секция «С кем познакомиться»
-- была пустой всегда. Разрешаем читать только те строки, где и целевой,
-- и рекомендованный ученик опубликованы — иначе через прямой anon-запрос
-- к таблице можно было бы увидеть reason для неопубликованного профиля.

drop policy if exists recommendations_anon_read on recommendations;
create policy recommendations_anon_read on recommendations
  for select to anon
  using (
    exists (
      select 1 from students st
      where st.id = recommendations.student_id and st.is_published = true
    )
    and exists (
      select 1 from students sr
      where sr.id = recommendations.recommended_id and sr.is_published = true
    )
  );
