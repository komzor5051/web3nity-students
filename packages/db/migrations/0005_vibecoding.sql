-- vibecoding-students: дельта к схеме web3nity под курс по вайб-кодингу.
-- Работа здесь — цифровой продукт (живой сайт, репозиторий), а не текстовый кейс.

alter table works add column if not exists live_url          text;
alter table works add column if not exists repo_url          text;
alter table works add column if not exists screenshot_path   text;
alter table works add column if not exists screenshot_failed boolean not null default false;
alter table works add column if not exists stack             text[] not null default '{}';

create index if not exists works_live_url_idx on works (live_url) where live_url is not null;

-- Ветка форума, из которой пришло сообщение. Классификация делается по ней.
alter table raw_messages add column if not exists topic_id bigint;
create index if not exists raw_messages_topic_idx on raw_messages (topic_id);

-- Новый источник: живой дамп через Telethon.
alter table raw_messages drop constraint if exists raw_messages_ingested_from_check;
alter table raw_messages add constraint raw_messages_ingested_from_check
  check (ingested_from in ('html_export','bot_pull','telegram_live'));

-- Когорта = тариф курса.
alter table students alter column cohort set default 'vibecoding-main';
