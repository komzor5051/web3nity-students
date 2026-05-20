-- web3nity-students: широкая сфера деятельности участника.
--
-- niche остаётся детальной (свободный текст из intro), а sphere — одна из
-- 5-7 канонических категорий (Маркетинг, Продажи, Разработка и т.п.).
-- Заполняется батч-скриптом scripts/spheres.ts. По sphere работает фильтр
-- на витрине: участник выбирает сферу и видит всех «коллег по цеху».

alter table students add column if not exists sphere text;

create index if not exists students_sphere_idx on students (sphere);
