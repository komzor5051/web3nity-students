/**
 * LLM-извлечение полей. Классификации здесь нет — тип поста уже известен
 * из ветки форума (topics.ts). У модели две задачи:
 *   1. разобрать самопредставление на поля профиля;
 *   2. отличить анонс собственной работы от реплики в обсуждении.
 *
 * Ссылки в промпт передаются уже извлечёнными (urls.ts) — модель не должна
 * их выдумывать или переписывать.
 */

import {
  GoogleGenerativeAI,
  SchemaType,
  type GenerateContentResult,
  type GenerationConfig,
  type GenerativeModel,
  type Schema,
} from '@google/generative-ai';
import type { GroupedPost } from './group.js';
import { extractUrls } from './urls.js';

export interface IntroFields {
  name?: string;
  age?: number;
  city?: string;
  country?: string;
  niche?: string;
  bio?: string;
  goal?: string;
  expertise?: string;
  hobbies?: string;
  status?: 'looking_for_clients' | 'looking_for_partners' | 'just_learning';
}

export interface WorkFields {
  /** true только если автор показывает СВОЮ работу, а не комментирует чужую. */
  isAnnouncement: boolean;
  title?: string;
  description?: string;
  /** Инструменты: ["claude code", "next.js", "supabase"]. */
  stack?: string[];
  tags?: string[];
}

export interface LLMConfig {
  apiKey?: string;
  model?: string;
  batchSize?: number;
  baseUrl?: string;
  onBatch?: (done: number, total: number) => void;
}

/**
 * Батч (или то, что от него осталось после рекурсивного деления), который
 * не удалось обработать — ни целиком, ни по частям вплоть до одного поста.
 */
export interface FailedBatch {
  /** rootMessageId каждого поста, попавшего в этот батч — они не дали записей. */
  rootMessageIds: number[];
  error: string;
}

/**
 * Результат батч-извлечения. failedBatches — обязательная часть ответа,
 * а не опциональная: вызывающий код обязан распаковать оба поля
 * (`const { results, failedBatches } = await extractIntros(...)`), и не может
 * молча продолжить, взяв только results, как было бы возможно с голым Map.
 */
export interface ExtractResult<T> {
  results: Map<number, T>;
  failedBatches: FailedBatch[];
}

/** Хотя бы 2 из этих полей должны быть заполнены, чтобы intro стало профилем. */
const MEANINGFUL_INTRO_FIELDS: (keyof IntroFields)[] = [
  'city',
  'country',
  'niche',
  'bio',
  'goal',
  'expertise',
];

/**
 * Одно имя — не представление. В ветке «Нетворкинг» кроме intro люди пишут
 * короткие реплики («Ок», «Добрый вечер», «Спасибо») — Gemini иногда всё
 * равно возвращает для них intro с одним лишь именем. Такой пост не должен
 * стать профилем на витрине.
 */
export function isMeaningfulIntro(intro: IntroFields): boolean {
  const filled = MEANINGFUL_INTRO_FIELDS.filter((field) => {
    const value = intro[field];
    return typeof value === 'string' && value.trim().length > 0;
  });
  return filled.length >= 2;
}

const INTRO_PROMPT = `Ты разбираешь самопредставления участников курса по вайб-кодингу (русский язык).
Каждый пост — рассказ человека о себе из ветки «Нетворкинг».

Извлеки поля:
- name — имя
- age — возраст числом
- city, country — город и страна
- niche — чем занимается, коротко
- bio — 1-2 предложения о себе
- goal — зачем пришёл на курс
- expertise — опыт и навыки
- hobbies — увлечения
- status: "looking_for_clients" если ищет клиентов или открыт к заказам;
  "looking_for_partners" если ищет партнёров; "just_learning" если учится для себя.

Все поля опциональны. Пиши только то, что явно есть в тексте. Не выдумывай.`;

const WORK_PROMPT = `Ты разбираешь ветку «SHOW CASE STUDIO» курса по вайб-кодингу (русский язык).
Это живое обсуждение: часть сообщений — показ собственной работы, часть — вопросы,
комментарии и ответы куратора.

Главное решение для каждого поста — isAnnouncement:
- true, если автор показывает СВОЙ результат: сайт, бот, сервис, таблицу, презентацию;
- false, если это вопрос, комментарий к чужой работе, благодарность, ответ куратора
  или организационное сообщение.

Если сомневаешься — ставь false. Ложная работа на витрине хуже пропущенной.

Для isAnnouncement=true извлеки:
- title — название проекта, 3-7 слов
- description — 1-3 предложения о том, что это и какую задачу решает
- stack — инструменты и технологии в нижнем регистре: ["claude code","next.js","supabase"]
- tags — 2-5 коротких тегов на русском в нижнем регистре

Работа без ссылки — нормально: не все проекты это сайты.
Ссылки уже извлечены и переданы в поле urls — не переписывай и не выдумывай их.`;

const INTRO_SCHEMA: Schema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      rootMessageId: { type: SchemaType.INTEGER },
      name: { type: SchemaType.STRING },
      age: { type: SchemaType.INTEGER },
      city: { type: SchemaType.STRING },
      country: { type: SchemaType.STRING },
      niche: { type: SchemaType.STRING },
      bio: { type: SchemaType.STRING },
      goal: { type: SchemaType.STRING },
      expertise: { type: SchemaType.STRING },
      hobbies: { type: SchemaType.STRING },
      status: {
        type: SchemaType.STRING,
        enum: ['looking_for_clients', 'looking_for_partners', 'just_learning'],
        format: 'enum',
      },
    },
    required: ['rootMessageId'],
  },
};

const WORK_SCHEMA: Schema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      rootMessageId: { type: SchemaType.INTEGER },
      isAnnouncement: { type: SchemaType.BOOLEAN },
      title: { type: SchemaType.STRING },
      description: { type: SchemaType.STRING },
      stack: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    },
    required: ['rootMessageId', 'isAnnouncement'],
  },
};

/**
 * Сколько символов текста поста класть в промпт. И для isAnnouncement/intro,
 * и для извлечения полей профиля двух тысяч более чем достаточно — обрезка
 * до 4000 просто раздувала вес запроса и, судя по всему, вносила вклад в
 * таймауты на больших батчах.
 */
const PROMPT_TEXT_LIMIT = 2_000;

export function buildWorkPrompt(batch: GroupedPost[]): string {
  const input = batch.map((p) => {
    const urls = extractUrls(p.text);
    return {
      rootMessageId: p.rootMessageId,
      author: p.authorName,
      text: p.text.slice(0, PROMPT_TEXT_LIMIT),
      urls: urls.allUrls,
      hasMedia: p.media.length > 0,
    };
  });
  return `Вот ${batch.length} постов в JSON. Верни JSON-массив той же длины.

ВХОД:
${JSON.stringify(input, null, 2)}`;
}

function buildIntroPrompt(batch: GroupedPost[]): string {
  const input = batch.map((p) => ({
    rootMessageId: p.rootMessageId,
    author: p.authorName,
    text: p.text.slice(0, PROMPT_TEXT_LIMIT),
  }));
  return `Вот ${batch.length} представлений в JSON. Верни JSON-массив той же длины.

ВХОД:
${JSON.stringify(input, null, 2)}`;
}

export function sanitizeIntroFields(raw: Record<string, unknown>): IntroFields {
  const out: IntroFields = {};
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined;
  out.name = str(raw.name);
  if (typeof raw.age === 'number' && raw.age > 10 && raw.age < 100) out.age = Math.floor(raw.age);
  out.city = str(raw.city);
  out.country = str(raw.country);
  out.niche = str(raw.niche);
  out.bio = str(raw.bio);
  out.goal = str(raw.goal);
  out.expertise = str(raw.expertise);
  out.hobbies = str(raw.hobbies);
  if (
    typeof raw.status === 'string' &&
    ['looking_for_clients', 'looking_for_partners', 'just_learning'].includes(raw.status)
  ) {
    out.status = raw.status as IntroFields['status'];
  }
  return out;
}

export function sanitizeWorkFields(raw: Record<string, unknown>): WorkFields {
  const out: WorkFields = { isAnnouncement: raw.isAnnouncement === true };
  if (typeof raw.title === 'string' && raw.title.trim()) {
    out.title = raw.title.trim().slice(0, 200);
  }
  if (typeof raw.description === 'string' && raw.description.trim()) {
    out.description = raw.description.trim().slice(0, 2000);
  }
  const list = (v: unknown): string[] =>
    Array.isArray(v)
      ? v
          .filter((x): x is string => typeof x === 'string')
          .map((x) => x.trim().toLowerCase())
          .filter((x) => x.length > 0 && x.length < 40)
          .slice(0, 8)
      : [];
  out.stack = list(raw.stack);
  out.tags = list(raw.tags);
  return out;
}

function makeModel(prompt: string, schema: Schema, config: LLMConfig): GenerativeModel {
  const apiKey = config.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required');
  const baseUrl = config.baseUrl ?? process.env.GEMINI_PROXY_URL ?? process.env.GEMINI_BASE_URL;
  const genai = new GoogleGenerativeAI(apiKey);
  return genai.getGenerativeModel(
    {
      model: config.model ?? process.env.LLM_MODEL ?? 'gemini-2.5-flash',
      systemInstruction: prompt,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.2,
        // У 2.5-flash «размышление» включено по умолчанию и стоит дорого:
        // на пустяковый запрос модель тратит больше тысячи thought-токенов,
        // а батч из восьми длинных постов не укладывался и в 180 секунд.
        // Достаём из поста готовые поля — рассуждать тут не над чем.
        // Поле есть в REST API, но не в типах старого SDK — отсюда каст.
        thinkingConfig: { thinkingBudget: 0 },
      } as GenerationConfig,
    },
    baseUrl ? { baseUrl } : undefined,
  );
}

// Gemini изредка подвешивает запрос: три одинаковых запроса подряд дали
// 1.3с, 1.0с и зависание дольше 90с. Ответ либо приходит за секунды, либо
// не приходит вовсе — ждать дольше бессмысленно, дешевле оборвать и
// повторить. Прежние 180с превращали каждое такое зависание в три минуты,
// а с ретраями — в девять, и полный прогон уходил за час.
export const GEMINI_TIMEOUT_MS = 30_000;

/** Обернуть вызов Gemini таймаутом: если ответа нет за timeoutMs — реджект,
 * дальше срабатывает существующая логика ретраев в runBatches. */
export async function generateWithTimeout(
  model: Pick<GenerativeModel, 'generateContent'>,
  prompt: string,
  timeoutMs: number = GEMINI_TIMEOUT_MS,
): Promise<GenerateContentResult> {
  let timer!: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Gemini не ответил за ${timeoutMs}мс`)), timeoutMs);
  });
  try {
    return await Promise.race([model.generateContent(prompt), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Батч по умолчанию — меньше запросов не в пользу, но каждый быстрее и надёжнее. */
const DEFAULT_BATCH_SIZE = 8;

/**
 * Пауза между батчами. Таймауты шли пачкой подряд (несколько батчей один
 * за другим) даже на чистом прогоне без внешней нагрузки — похоже на rate
 * limit Gemini, а не на единичный сетевой сбой, поэтому притормаживаем сами.
 */
export const BATCH_PAUSE_MS = 500;
/**
 * Задержки перед повторами. Зависание — не признак перегрузки на нашей
 * стороне, поэтому долго отступать незачем: повторов больше, паузы короче.
 */
export const RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Обрабатывает один батч с повторами. Если все попытки провалены и в
 * батче больше одного поста — делит его пополам и пробует половины по
 * отдельности рекурсивно (батч обычно падает из-за размера/веса запроса,
 * а не из-за конкретного поста, так что половина может пройти). Сдаётся
 * только на батче размером 1 — тогда пост уходит в failedBatches.
 */
async function processBatch<T>(
  batch: GroupedPost[],
  model: GenerativeModel,
  buildPrompt: (batch: GroupedPost[]) => string,
  sanitize: (raw: Record<string, unknown>) => T,
  out: Map<number, T>,
  failedBatches: FailedBatch[],
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS_MS[attempt - 1]!);
    }
    try {
      const response = await generateWithTimeout(model, buildPrompt(batch));
      const parsed = JSON.parse(response.response.text()) as Record<string, unknown>[];
      if (!Array.isArray(parsed)) throw new Error('ответ не массив');
      for (const item of parsed) {
        const id = item.rootMessageId;
        if (typeof id === 'number') out.set(id, sanitize(item));
      }
      return;
    } catch (e) {
      lastError = e;
    }
  }

  if (batch.length > 1) {
    const mid = Math.ceil(batch.length / 2);
    await processBatch(batch.slice(0, mid), model, buildPrompt, sanitize, out, failedBatches);
    await processBatch(batch.slice(mid), model, buildPrompt, sanitize, out, failedBatches);
    return;
  }

  // Батч размером 1 и всё равно провален — сдаёмся. Вызывающий код обязан
  // прочитать failedBatches и не молчать об этом.
  console.warn(`[extract] пост ${batch[0]!.rootMessageId} провален: ${String(lastError)}`);
  failedBatches.push({
    rootMessageIds: [batch[0]!.rootMessageId],
    error: String(lastError),
  });
}

async function runBatches<T>(
  posts: GroupedPost[],
  model: GenerativeModel,
  buildPrompt: (batch: GroupedPost[]) => string,
  sanitize: (raw: Record<string, unknown>) => T,
  config: LLMConfig,
): Promise<ExtractResult<T>> {
  const batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
  const out = new Map<number, T>();
  const failedBatches: FailedBatch[] = [];

  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize);
    await processBatch(batch, model, buildPrompt, sanitize, out, failedBatches);
    config.onBatch?.(Math.min(i + batchSize, posts.length), posts.length);
    if (i + batchSize < posts.length) await sleep(BATCH_PAUSE_MS);
  }
  return { results: out, failedBatches };
}

export async function extractIntros(
  posts: GroupedPost[],
  config: LLMConfig = {},
): Promise<ExtractResult<IntroFields>> {
  const model = makeModel(INTRO_PROMPT, INTRO_SCHEMA, config);
  return runBatches(posts, model, buildIntroPrompt, sanitizeIntroFields, config);
}

export async function extractWorks(
  posts: GroupedPost[],
  config: LLMConfig = {},
): Promise<ExtractResult<WorkFields>> {
  const model = makeModel(WORK_PROMPT, WORK_SCHEMA, config);
  return runBatches(posts, model, buildWorkPrompt, sanitizeWorkFields, config);
}
