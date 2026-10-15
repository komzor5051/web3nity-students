-- Два отдельных обучения на одной платформе: vibecoding и assistants.
-- У каждого своя база учеников. Человек, учившийся на обоих, получает две
-- анкеты (по одной на курс). Работы и рекомендации принадлежат анкете, поэтому
-- их курс следует из student_id — отдельная колонка не нужна.
-- cohort остаётся меткой потока внутри курса (vibecoding-2.0 и т. п.).
alter table vibe_students add column course text not null default 'vibecoding' check (course in ('vibecoding','assistants'));
alter table vibe_students drop constraint vibe_students_telegram_user_id_key;
alter table vibe_students add constraint vibe_students_tg_course_key unique (telegram_user_id, course);
create index vibe_students_course_idx on vibe_students (course);
alter table vibe_members add column course text not null default 'vibecoding' check (course in ('vibecoding','assistants'));
alter table vibe_members drop constraint vibe_members_pkey;
alter table vibe_members add primary key (telegram_user_id, course);
