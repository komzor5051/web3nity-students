/**
 * LLM-доразметка статуса участника по уже извлечённым полям профиля.
 *
 * Используется батч-скриптом (scripts/enrich-status.ts) для тех, у кого
 * status пуст: исходная intro-классификация не угадывала статус, если он не
 * был явно в тексте самопрезентации. Здесь мы пытаемся вывести доминирующее
 * намерение из bio/goal/expertise — но так же консервативно: null лучше, чем
 * выдуманный статус.
 */

import { GoogleGenerativeAI, SchemaType, type GenerativeModel, type Schema } from '@google/generative-ai';

export type Status = 'looking_for_clients' | 'looking_for_partners' | 'just_learning';

export interface StatusInput {
  idx: number;
  name: string;
  niche?: string;
  bio?: string;
  goal?: string;
  expertise?: string;
  hobbies?: string;
}

export interface StatusOut {
  idx: number;
  status: Status;
}

const VALID: Status[] = ['looking_for_clients', 'looking_for_partners', 'just_learning'];

const SYSTEM_PROMPT = `Ты размечаешь намерение участников курса "AI-Ассистенты 3.0" по их профилю.

На вход — профили (ниша, био, цель, опыт). Для каждого определи ОДИН доминирующий статус ИЛИ оставь пустым.

Статусы:
- "looking_for_clients" — ищет клиентов/заказы, хочет зарабатывать на услугах, продавать своё AI-решение, фриланс, продвигает продукт.
- "looking_for_partners" — ищет партнёров/команду/коллаборации, хочет делать совместные проекты.
- "just_learning" — учится для себя или для текущей работы/найма, прокачивает навык без коммерческого или партнёрского намерения.

Правила (важно):
- НЕ угадывай. Сам факт участия в курсе — это НЕ "just_learning". Ставь статус только если намерение явно читается из текста профиля.
- Если намерение неясно или профиль пустой — НЕ возвращай этот idx вообще (лучше пропустить, чем ошибиться).
- Один статус на участника, самый сильный сигнал.`;

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      idx: { type: SchemaType.INTEGER },
      status: {
        type: SchemaType.STRING,
        enum: ['looking_for_clients', 'looking_for_partners', 'just_learning'],
        format: 'enum',
      },
    },
    required: ['idx', 'status'],
  },
};

export interface EnrichConfig {
  apiKey?: string;
  model?: string;
  batchSize?: number;
  maxRetries?: number;
  baseUrl?: string;
  onBatch?: (done: number, total: number) => void;
}

/**
 * Выводит статус для участников, у которых он не задан.
 * Возвращает только тех, по кому модель уверена (остальные — пропуск).
 */
export async function inferStatuses(
  inputs: StatusInput[],
  config: EnrichConfig = {},
): Promise<StatusOut[]> {
  const apiKey = config.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required');

  const modelName = config.model ?? process.env.LLM_MODEL ?? 'gemini-2.5-flash';
  const batchSize = config.batchSize ?? 30;
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
        maxOutputTokens: 8192,
      },
    },
    baseUrl ? { baseUrl } : undefined,
  );

  const inputIdx = new Set(inputs.map((i) => i.idx));
  const out: StatusOut[] = [];
  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = await inferBatch(model, inputs.slice(i, i + batchSize), maxRetries, inputIdx);
    out.push(...batch);
    config.onBatch?.(Math.min(i + batchSize, inputs.length), inputs.length);
  }
  return out;
}

async function inferBatch(
  model: GenerativeModel,
  batch: StatusInput[],
  maxRetries: number,
  inputIdx: Set<number>,
): Promise<StatusOut[]> {
  const prompt = `Профили участников (JSON). Верни JSON-массив только по тем idx, для кого статус явно читается — остальных пропусти.

ВХОД:
${JSON.stringify(batch, null, 1)}`;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await model.generateContent(prompt);
      const parsed = JSON.parse(response.response.text());
      if (!Array.isArray(parsed)) throw new Error('response is not an array');
      return sanitize(parsed, inputIdx);
    } catch (e) {
      lastError = e;
      if (attempt === maxRetries) break;
    }
  }
  throw new Error(`inferBatch failed: ${String(lastError)}`);
}

function sanitize(parsed: unknown[], inputIdx: Set<number>): StatusOut[] {
  const out: StatusOut[] = [];
  const seen = new Set<number>();
  for (const raw of parsed) {
    const item = raw as Record<string, unknown>;
    const idx = item.idx;
    const status = item.status;
    if (typeof idx !== 'number' || !inputIdx.has(idx) || seen.has(idx)) continue;
    if (typeof status !== 'string' || !VALID.includes(status as Status)) continue;
    seen.add(idx);
    out.push({ idx, status: status as Status });
  }
  return out;
}
