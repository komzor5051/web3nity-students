/**
 * Разбор постов без LLM.
 *
 * Тип поста уже известен из ветки форума (topics.ts), ссылки — из urls.ts.
 * Остаётся вытащить заголовок, описание и пару полей профиля, а это правила,
 * а не рассуждение: заголовок — первая содержательная строка, описание —
 * следующие, стек — упоминания известных инструментов.
 *
 * Хуже LLM в одном: не понимает смысл. Поэтому все правила консервативны —
 * лучше пустое поле, чем выдуманное.
 */

import type { GroupedPost } from './group.js';
import { extractUrls } from './urls.js';
import type { IntroFields, WorkFields } from './extract.js';

const MAX_TITLE = 80;
const MAX_DESCRIPTION = 400;
const MAX_BIO = 600;

/** Инструменты, которые ученики называют в постах. Совпадение — точное слово. */
const STACK_TERMS: Record<string, string> = {
  lovable: 'Lovable',
  cursor: 'Cursor',
  'claude code': 'Claude Code',
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gpt: 'GPT',
  n8n: 'n8n',
  make: 'Make',
  supabase: 'Supabase',
  airtable: 'Airtable',
  netlify: 'Netlify',
  vercel: 'Vercel',
  'next.js': 'Next.js',
  react: 'React',
  tilda: 'Tilda',
  figma: 'Figma',
  bolt: 'Bolt',
  replit: 'Replit',
  windsurf: 'Windsurf',
  telegram: 'Telegram',
  python: 'Python',
  notion: 'Notion',
};

/** Города, которые реально встречаются в представлениях этого курса. */
const CITIES = [
  'Москва', 'Санкт-Петербург', 'Питер', 'Новосибирск', 'Екатеринбург', 'Казань',
  'Нижний Новгород', 'Челябинск', 'Самара', 'Омск', 'Ростов-на-Дону', 'Уфа',
  'Красноярск', 'Воронеж', 'Пермь', 'Волгоград', 'Краснодар', 'Сочи', 'Тюмень',
  'Иркутск', 'Хабаровск', 'Владивосток', 'Калининград', 'Ижевск', 'Барнаул',
  'Ульяновск', 'Ярославль', 'Томск', 'Оренбург', 'Кемерово', 'Рязань', 'Липецк',
  'Пенза', 'Астрахань', 'Киров', 'Чебоксары', 'Курск', 'Тверь', 'Ставрополь',
  'Сургут', 'Южно-Сахалинск', 'Владикавказ', 'Грозный', 'Махачкала', 'Якутск',
  'Минск', 'Гомель', 'Брест', 'Киев', 'Одесса', 'Харьков', 'Алматы', 'Астана',
  'Шымкент', 'Караганда', 'Ташкент', 'Бишкек', 'Ереван', 'Тбилиси', 'Баку',
  'Дубай', 'Стамбул', 'Анталья', 'Белград', 'Бангкок', 'Пхукет', 'Лиссабон',
  'Барселона', 'Мадрид', 'Берлин', 'Варшава', 'Прага', 'Лондон', 'Нью-Йорк',
  'Пекин', 'Шанхай', 'Гуанчжоу',
  // Курс международный: половина участников пишет из-за рубежа.
  'Копенгаген', 'Стокгольм', 'Осло', 'Хельсинки', 'Рига', 'Вильнюс', 'Таллин',
  'Париж', 'Марсель', 'Лион', 'Ницца', 'Милан', 'Рим', 'Вена', 'Цюрих',
  'Амстердам', 'Брюссель', 'Дублин', 'Афины', 'Лимассол', 'Никосия', 'Пафос',
  'Будва', 'Тиват', 'Подгорица', 'Батуми', 'Кишинёв', 'Кишинев', 'Ереван',
  'Марбелья', 'Валенсия', 'Малага', 'Аликанте', 'Порту', 'Дюссельдорф',
  'Мюнхен', 'Гамбург', 'Франкфурт', 'Сидней', 'Мельбурн', 'Торонто', 'Дели',
];

/**
 * Страны на случай, когда города нет: «живу в Норвегии», «Moldova».
 * Ключ — как пишут в тексте, значение — каноничное имя для карточки.
 */
const COUNTRIES: Record<string, string> = {
  Россия: 'Россия', Норвегия: 'Норвегия', Швеция: 'Швеция', Дания: 'Дания',
  Финляндия: 'Финляндия', Литва: 'Литва', Латвия: 'Латвия', Эстония: 'Эстония',
  Франция: 'Франция', Германия: 'Германия', Испания: 'Испания', Италия: 'Италия',
  Португалия: 'Португалия', Нидерланды: 'Нидерланды', Бельгия: 'Бельгия',
  Швейцария: 'Швейцария', Австрия: 'Австрия', Ирландия: 'Ирландия',
  Греция: 'Греция', Кипр: 'Кипр', Черногория: 'Черногория', Сербия: 'Сербия',
  Болгария: 'Болгария', Польша: 'Польша', Чехия: 'Чехия', Венгрия: 'Венгрия',
  Молдова: 'Молдова', Moldova: 'Молдова', Молдавия: 'Молдова',
  Украина: 'Украина', Беларусь: 'Беларусь', Белоруссия: 'Беларусь',
  Грузия: 'Грузия', Армения: 'Армения', Азербайджан: 'Азербайджан',
  Казахстан: 'Казахстан', Узбекистан: 'Узбекистан', Киргизия: 'Киргизия',
  Турция: 'Турция', ОАЭ: 'ОАЭ', Израиль: 'Израиль', Таиланд: 'Таиланд',
  Вьетнам: 'Вьетнам', Индонезия: 'Индонезия', Бали: 'Индонезия',
  Великобритания: 'Великобритания', Англия: 'Великобритания',
  США: 'США', Канада: 'Канада', Австралия: 'Австралия', Китай: 'Китай',
  Индия: 'Индия', Аргентина: 'Аргентина', Бразилия: 'Бразилия', Мексика: 'Мексика',
};

const CITY_COUNTRY_EXTRA: Record<string, string> = {
  Копенгаген: 'Дания', Стокгольм: 'Швеция', Осло: 'Норвегия', Хельсинки: 'Финляндия',
  Рига: 'Латвия', Вильнюс: 'Литва', Таллин: 'Эстония',
  Париж: 'Франция', Марсель: 'Франция', Лион: 'Франция', Ницца: 'Франция',
  Милан: 'Италия', Рим: 'Италия', Вена: 'Австрия', Цюрих: 'Швейцария',
  Амстердам: 'Нидерланды', Брюссель: 'Бельгия', Дублин: 'Ирландия',
  Афины: 'Греция', Лимассол: 'Кипр', Никосия: 'Кипр', Пафос: 'Кипр',
  Будва: 'Черногория', Тиват: 'Черногория', Подгорица: 'Черногория',
  Батуми: 'Грузия', 'Кишинёв': 'Молдова', Кишинев: 'Молдова',
  Марбелья: 'Испания', Валенсия: 'Испания', Малага: 'Испания', Аликанте: 'Испания',
  Порту: 'Португалия', Дюссельдорф: 'Германия', Мюнхен: 'Германия',
  Гамбург: 'Германия', Франкфурт: 'Германия',
  Сидней: 'Австралия', Мельбурн: 'Австралия', Торонто: 'Канада', Дели: 'Индия',
};

/**
 * Сферы деятельности — короткий общий список, чтобы фильтр на витрине имел
 * смысл. Каждая сфера задана словами, которые люди пишут о себе; порядок
 * важен, побеждает первое совпадение.
 */
const SPHERES: { sphere: string; terms: string[] }[] = [
  { sphere: 'Недвижимость', terms: ['недвижимост', 'риелтор', 'риэлтор', 'девелоп', 'новостро', 'аренд'] },
  { sphere: 'Маркетинг', terms: ['маркетинг', 'реклам', 'смм', 'таргет', 'трафик', 'бренд'] },
  { sphere: 'Юриспруденция', terms: ['юрист', 'юридическ', 'адвокат', 'право'] },
  { sphere: 'Финансы', terms: ['бухгалтер', 'финанс', 'аудит', 'налог', 'инвест'] },
  // Без «курс» и «обучение»: их пишут все — они пришли на курс учиться,
  // а сфера деятельности у них другая.
  { sphere: 'Образование', terms: ['преподава', 'педагог', 'школ', 'репетитор', 'методист', 'образовательн'] },
  { sphere: 'Здоровье', terms: ['врач', 'медицин', 'клиник', 'стоматолог', 'нутрициолог', 'фитнес'] },
  { sphere: 'Психология', terms: ['психолог', 'коуч', 'терапевт', 'ментор'] },
  { sphere: 'Логистика', terms: ['логист', 'перевозк', 'доставк', 'вэд', 'таможн'] },
  { sphere: 'Туризм', terms: ['туризм', 'турагент', 'туропер', 'путешеств', 'отел'] },
  { sphere: 'E-commerce', terms: ['маркетплейс', 'ozon', 'wildberries', 'etsy', 'amazon', 'интернет-магазин', 'e-commerce'] },
  { sphere: 'IT', terms: ['разработчик', 'программист', 'it-', 'айти', 'devops', 'аналитик данных'] },
  { sphere: 'Дизайн', terms: ['дизайн', 'иллюстрат', 'архитектор'] },
  { sphere: 'HR', terms: ['рекрут', 'hr', 'подбор персонал', 'кадров'] },
  { sphere: 'Строительство', terms: ['строительств', 'ремонт', 'подряд', 'жкх', 'проектирован'] },
  { sphere: 'Производство', terms: ['производств', 'завод', 'цех', 'оптов'] },
  { sphere: 'Консалтинг', terms: ['консалтинг', 'консультир', 'управленческ'] },
  { sphere: 'Медиа', terms: ['продюсер', 'блогер', 'контент', 'видео', 'медиа', 'журналист'] },
  { sphere: 'Культура', terms: ['культур', 'искусств', 'музык', 'хореограф', 'театр', 'галере'] },
  { sphere: 'Общепит', terms: ['ресторан', 'кафе', 'кофейн', 'кулинар', 'кондитер'] },
  { sphere: 'Красота', terms: ['салон красоты', 'бьюти', 'косметолог', 'парикмахер'] },
];

/**
 * Сфера деятельности по тексту о себе. Одна, самая первая совпавшая:
 * человек обычно описывает несколько занятий, а фильтру нужна категория.
 */
export function sphereFrom(text: string): string | null {
  const lower = text.toLowerCase();
  for (const { sphere, terms } of SPHERES) {
    if (terms.some((t) => lower.includes(t))) return sphere;
  }
  return null;
}

const COUNTRY_BY_CITY: Record<string, string> = {
  Минск: 'Беларусь', Гомель: 'Беларусь', Брест: 'Беларусь',
  Киев: 'Украина', Одесса: 'Украина', Харьков: 'Украина',
  Алматы: 'Казахстан', Астана: 'Казахстан', Шымкент: 'Казахстан', Караганда: 'Казахстан',
  Ташкент: 'Узбекистан', Бишкек: 'Киргизия', Ереван: 'Армения', Тбилиси: 'Грузия',
  Баку: 'Азербайджан', Дубай: 'ОАЭ', Стамбул: 'Турция', Анталья: 'Турция',
  Белград: 'Сербия', Бангкок: 'Таиланд', Пхукет: 'Таиланд', Лиссабон: 'Португалия',
  Барселона: 'Испания', Мадрид: 'Испания', Берлин: 'Германия', Варшава: 'Польша',
  Прага: 'Чехия', Лондон: 'Великобритания', 'Нью-Йорк': 'США',
  Пекин: 'Китай', Шанхай: 'Китай', Гуанчжоу: 'Китай',
};

/** Строки-украшения, которые не могут быть заголовком работы. */
const NOISE_LINE = /^[\s\p{Emoji_Presentation}\p{Extended_Pictographic}*_~`#>\-—–•·|]+$/u;

function cleanLine(line: string): string {
  return line
    // Ссылка посреди строки в заголовке карточки только мешает: адрес и так
    // показан отдельной кнопкой («https://site.app вот мой сайт» → «вот мой сайт»).
    .replace(/https?:\/\/\S+/gi, ' ')
    // Хэштег-метка ветки в начале строки («#обомне Всем привет!») — служебная,
    // в тексте профиля она читается как опечатка.
    // \b здесь не годится: границу слова он считает по ASCII, и после
    // кириллической буквы её просто нет.
    .replace(/^\s*#[\p{L}_]+/u, '')
    // markdown-разметка и ведущие маркеры списка
    .replace(/^[\s*_~`#>\-—–•·]+/u, '')
    .replace(/[*_~`]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Содержательные строки поста: без пустых, без чистых URL, без украшений. */
export function meaningfulLines(text: string): string[] {
  return text
    .split('\n')
    .map(cleanLine)
    .filter((line) => line.length > 0 && !NOISE_LINE.test(line) && !/^https?:\/\/\S+$/i.test(line));
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Приветствия и обращения. Пост про работу часто начинается с «Добрый день!»,
 * и такая строка в заголовке карточки не говорит ни о чём.
 */
const ADDRESSEE = '(коллеги|друзья|ребята|народ|вайбкодеры|вайб-кодеры|всем)';
const GREETING = new RegExp(
  `^(всем\\s+)?(привет|здравствуйте|добрый\\s+(день|вечер|утро)|доброе\\s+утро|доброго\\s+времени|хай|salut|hello|hi)[\\s,!.)]*${ADDRESSEE}?[\\s,!.)]*$`,
  'iu',
);
const ADDRESS = new RegExp(
  `^(${ADDRESSEE}|дорогие\\s+\\p{L}+|уважаемые\\s+\\p{L}+)[\\s,!.)]*$`,
  'iu',
);

/** Строка, с которой не стоит начинать карточку работы. */
function isOpener(line: string): boolean {
  return GREETING.test(line) || ADDRESS.test(line);
}

/**
 * Заголовок работы — первая содержательная строка, кроме приветствия.
 * Длинную режем по границе предложения: у половины постов первая строка
 * это уже целый абзац.
 */
export function titleFrom(text: string): string | null {
  const lines = meaningfulLines(text);
  const first = lines.find((line) => !isOpener(line)) ?? lines[0];
  if (!first) return null;
  if (first.length <= MAX_TITLE) return first;
  const sentenceEnd = first.search(/[.!?]\s/);
  if (sentenceEnd > 0 && sentenceEnd <= MAX_TITLE) return first.slice(0, sentenceEnd + 1).trim();
  return truncate(first, MAX_TITLE);
}

/** Описание — то, что после заголовка. */
export function descriptionFrom(text: string): string | null {
  const lines = meaningfulLines(text).filter((line) => !isOpener(line));
  if (lines.length === 0) return null;
  const [first, ...rest] = lines;
  // Заголовок отрезали от первой строки — остаток тоже часть описания.
  const tail = first!.length > MAX_TITLE ? [first!] : rest;
  const joined = tail.join(' ').trim();
  return joined.length > 0 ? truncate(joined, MAX_DESCRIPTION) : null;
}

/** Инструменты, названные в тексте. */
export function stackFrom(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const [term, label] of Object.entries(STACK_TERMS)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'iu').test(lower)) {
      found.add(label);
    }
  }
  return [...found];
}

/**
 * Основа названия для поиска в тексте: города склоняются («из Питера»,
 * «в Москве»), поэтому отбрасываем окончание и допускаем любое другое.
 */
function cityStem(city: string): string {
  const stem = city.length > 4 ? city.replace(/[аяьеиы]$/iu, '') : city;
  return stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Город из текста представления, а если города нет — хотя бы страна
 * («живу в Норвегии»). Без совпадения — null, догадок не строим.
 */
export function cityFrom(text: string): { city: string | null; country: string | null } {
  for (const city of CITIES) {
    if (new RegExp(`(^|[^\\p{L}])${cityStem(city)}[\\p{L}]{0,3}([^\\p{L}]|$)`, 'iu').test(text)) {
      const canonical = city === 'Питер' ? 'Санкт-Петербург' : city;
      const country = COUNTRY_BY_CITY[canonical] ?? CITY_COUNTRY_EXTRA[canonical] ?? 'Россия';
      return { city: canonical, country };
    }
  }
  for (const [written, canonical] of Object.entries(COUNTRIES)) {
    if (new RegExp(`(^|[^\\p{L}])${cityStem(written)}[\\p{L}]{0,3}([^\\p{L}]|$)`, 'iu').test(text)) {
      return { city: null, country: canonical };
    }
  }
  return { city: null, country: null };
}

/** Хостинги вайб-кодинга: их суффикс в названии работы — шум. */
const HOSTING_SUFFIX =
  /\.(lovable\.app|lovable\.dev|netlify\.app|vercel\.app|abacusai\.app|pages\.dev|github\.io|web\.app|onrender\.com)$/i;

/**
 * Название из адреса сайта: «kavkaz-route-hub.lovable.app» → «Kavkaz Route Hub».
 * Нужно там, где весь текст поста — «Добрый день!», а работа лежит по ссылке.
 */
export function titleFromUrl(rawUrl: string): string | null {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.replace(/^www\./i, '');
  } catch {
    return null;
  }
  // Пунякод (кириллические домены) читаемым не сделать — оставляем адрес как есть.
  if (host.startsWith('xn--')) return host;
  const name = host.replace(HOSTING_SUFFIX, '').split('.')[0] ?? '';
  // id-preview--d0d29c30-… и прочие технические имена: слов нет, только мусор.
  const words = name
    .split(/[-_]+/)
    // Отбрасываем куски технических имён: цифры и hex-хвосты вроде «693f».
    .filter((w) => w.length > 1 && !/^\d+$/.test(w) && !/^[0-9a-f]{4,}$/i.test(w));
  if (words.length === 0) return null;
  // Хвост-идентификатор, который платформа приписывает к имени проекта
  // («executive-ai-academy-7ihrb3»): буквы вперемешку с цифрами, коротко и
  // не первым словом — на название это не похоже.
  const last = words[words.length - 1]!;
  if (words.length > 1 && last.length <= 8 && /\d/.test(last) && /[a-z]/i.test(last)) {
    words.pop();
  }
  return words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Профиль из представления. Имя не угадываем — оно приходит из Telegram,
 * а текст поста целиком идёт в «о себе».
 */
export function introFrom(post: GroupedPost): IntroFields {
  const lines = meaningfulLines(post.text);
  const { city, country } = cityFrom(post.text);
  const bio = truncate(lines.join(' '), MAX_BIO);
  return {
    ...(bio ? { bio } : {}),
    ...(city ? { city } : {}),
    ...(country ? { country } : {}),
  };
}

/**
 * Работа из поста ветки показа. Анонсом считаем пост со ссылкой на живой
 * сайт или репозиторий: в этой ветке иначе постить нечего, а реплики
 * обсуждения ссылок не содержат.
 */
/**
 * Похоже ли на название работы, а не на реплику в чате.
 *
 * «Kavkaz Route Hub» — название. «Уважаемые коллеги, делюсь своим первым
 * опытом.» — фраза: в подписи к карточке она читается как обрывок переписки,
 * и лучше взять имя из адреса сайта, а фразу оставить в описании.
 */
export function looksLikeName(line: string): boolean {
  if (isOpener(line)) return false;
  if (/[.!?…,;:)]$/u.test(line)) return false;
  return line.split(/\s+/).length <= 5;
}

export function workFrom(post: GroupedPost): WorkFields {
  const urls = extractUrls(post.text);
  const isAnnouncement = Boolean(urls.liveUrl || urls.repoUrl);
  if (!isAnnouncement) return { isAnnouncement: false, stack: [], tags: [] };

  const fromText = titleFrom(post.text);
  const fromUrl = titleFromUrl(urls.liveUrl ?? urls.repoUrl ?? '');
  const useText = Boolean(fromText && looksLikeName(fromText));
  const title = useText ? fromText : (fromUrl ?? fromText);

  // Если заголовок взяли из адреса, первая строка поста никуда не делась —
  // она часть рассказа о работе, и место ей в описании.
  const description = useText ? descriptionFrom(post.text) : fullTextDescription(post.text);

  return {
    isAnnouncement: true,
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    stack: stackFrom(post.text),
    tags: [],
  };
}

function fullTextDescription(text: string): string | null {
  const joined = meaningfulLines(text)
    .filter((line) => !isOpener(line))
    .join(' ')
    .trim();
  return joined.length > 0 ? truncate(joined, MAX_DESCRIPTION) : null;
}
