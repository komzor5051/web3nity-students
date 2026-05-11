import { GoogleGenerativeAI, SchemaType, type GenerativeModel, type Schema } from '@google/generative-ai';
import type { GroupedPost } from './group.js';

export type PostClass = 'intro' | 'work' | 'qa' | 'chat';

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
  title?: string;
  description?: string;
  tags?: string[];
}

export interface ClassifiedPost {
  rootMessageId: number;
  classified_as: PostClass;
  intro?: IntroFields;
  work?: WorkFields;
}

const SYSTEM_PROMPT = `Ты классификатор сообщений из закрытого чата курса "AI-Ассистенты 3.0" на русском языке.
На вход тебе дают батч постов (текст + автор). Каждый пост нужно отнести к одной из категорий:

- "intro": самопрезентация студента. Содержит хотя бы 2 из: имя, возраст, город/страна, профессия/ниша, цель обучения. Часто с тегом #обомне.
- "work": кейс / результат / показ работы. Студент рассказывает что сделал, демо, проект, скрин результата.
- "qa": вопрос или ответ в техническом обсуждении (как настроить, что выбрать, помощь с ошибкой).
- "chat": болтовня, реакции, благодарности, мемы, не несущие пользы для витрины.

Для intro извлеки поля: name, age (число), city, country, niche (короткое название специализации), bio (1-2 предложения о себе), goal (зачем учится), expertise (опыт/навыки), hobbies, status.
status:
  - "looking_for_clients" — ищет клиентов / открыт к заказам;
  - "looking_for_partners" — ищет партнёров / коллабы;
  - "just_learning" — учится для себя / в найме.
  Не угадывай — если в тексте этого нет, не указывай.

Для work извлеки: title (короткое название кейса, 3-7 слов), description (1-3 предложения), tags (массив 2-5 коротких тегов на русском в нижнем регистре, например ["n8n","телеграм-бот","crm"]).

Все поля опциональны — пиши только то, что явно в тексте. Не выдумывай.`;

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      idx: { type: SchemaType.INTEGER },
      rootMessageId: { type: SchemaType.INTEGER },
      classified_as: {
        type: SchemaType.STRING,
        enum: ['intro', 'work', 'qa', 'chat'],
        format: 'enum',
      },
      intro: {
        type: SchemaType.OBJECT,
        properties: {
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
      },
      work: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
      },
    },
    required: ['idx', 'rootMessageId', 'classified_as'],
  },
};

export interface LLMConfig {
  apiKey?: string;
  model?: string;
  batchSize?: number;
  maxRetries?: number;
  /** Базовый URL для запросов (например, Cloudflare-прокси для обхода гео-блокировки). */
  baseUrl?: string;
  onBatch?: (done: number, total: number) => void;
}

export async function classifyPosts(
  posts: GroupedPost[],
  config: LLMConfig = {},
): Promise<ClassifiedPost[]> {
  const apiKey = config.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required');

  const modelName = config.model ?? process.env.LLM_MODEL ?? 'gemini-2.5-flash';
  const batchSize = config.batchSize ?? 20;
  const maxRetries = config.maxRetries ?? 2;

  const baseUrl = config.baseUrl ?? process.env.GEMINI_PROXY_URL ?? process.env.GEMINI_BASE_URL;

  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel(
    {
      model: modelName,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
      },
    },
    baseUrl ? { baseUrl } : undefined,
  );

  const out: ClassifiedPost[] = [];
  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize);
    const result = await classifyBatch(model, batch, maxRetries);
    out.push(...result);
    config.onBatch?.(Math.min(i + batchSize, posts.length), posts.length);
  }
  return out;
}

async function classifyBatch(
  model: GenerativeModel,
  batch: GroupedPost[],
  maxRetries: number,
): Promise<ClassifiedPost[]> {
  const userInput = batch.map((p, idx) => ({
    idx,
    rootMessageId: p.rootMessageId,
    author: p.authorName,
    text: p.text.slice(0, 4000),
    hasMedia: p.media.length > 0,
  }));

  const userPrompt = `Вот ${batch.length} постов в JSON. Верни JSON-массив той же длины с полями {idx, rootMessageId, classified_as, intro?, work?}.

ВХОД:
${JSON.stringify(userInput, null, 2)}`;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await model.generateContent(userPrompt);
      const text = response.response.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('response is not an array');
      return validateClassified(parsed, batch);
    } catch (e) {
      lastError = e;
      if (attempt === maxRetries) break;
    }
  }
  throw new Error(`classifyBatch failed after ${maxRetries + 1} attempts: ${String(lastError)}`);
}

function validateClassified(parsed: unknown[], batch: GroupedPost[]): ClassifiedPost[] {
  if (parsed.length !== batch.length) {
    throw new Error(`expected ${batch.length} items, got ${parsed.length}`);
  }
  const valid: PostClass[] = ['intro', 'work', 'qa', 'chat'];
  return parsed.map((raw, idx) => {
    const item = raw as Record<string, unknown>;
    const cls = item.classified_as;
    if (typeof cls !== 'string' || !valid.includes(cls as PostClass)) {
      throw new Error(`item ${idx}: invalid classified_as=${String(cls)}`);
    }
    const out: ClassifiedPost = {
      rootMessageId: batch[idx]!.rootMessageId,
      classified_as: cls as PostClass,
    };
    if (cls === 'intro' && item.intro && typeof item.intro === 'object') {
      out.intro = sanitizeIntro(item.intro as Record<string, unknown>);
    }
    if (cls === 'work' && item.work && typeof item.work === 'object') {
      out.work = sanitizeWork(item.work as Record<string, unknown>);
    }
    return out;
  });
}

function sanitizeIntro(raw: Record<string, unknown>): IntroFields {
  const out: IntroFields = {};
  if (typeof raw.name === 'string') out.name = raw.name.trim() || undefined;
  if (typeof raw.age === 'number' && raw.age > 10 && raw.age < 100) out.age = Math.floor(raw.age);
  if (typeof raw.city === 'string') out.city = raw.city.trim() || undefined;
  if (typeof raw.country === 'string') out.country = raw.country.trim() || undefined;
  if (typeof raw.niche === 'string') out.niche = raw.niche.trim() || undefined;
  if (typeof raw.bio === 'string') out.bio = raw.bio.trim() || undefined;
  if (typeof raw.goal === 'string') out.goal = raw.goal.trim() || undefined;
  if (typeof raw.expertise === 'string') out.expertise = raw.expertise.trim() || undefined;
  if (typeof raw.hobbies === 'string') out.hobbies = raw.hobbies.trim() || undefined;
  if (
    typeof raw.status === 'string' &&
    ['looking_for_clients', 'looking_for_partners', 'just_learning'].includes(raw.status)
  ) {
    out.status = raw.status as IntroFields['status'];
  }
  return out;
}

function sanitizeWork(raw: Record<string, unknown>): WorkFields {
  const out: WorkFields = {};
  if (typeof raw.title === 'string') out.title = raw.title.trim().slice(0, 200) || undefined;
  if (typeof raw.description === 'string') out.description = raw.description.trim().slice(0, 2000) || undefined;
  if (Array.isArray(raw.tags)) {
    out.tags = raw.tags
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && t.length < 40)
      .slice(0, 8);
  }
  return out;
}
