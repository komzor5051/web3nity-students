/**
 * LLM-подбор полезных знакомств между участниками курса.
 *
 * Используется батч-скриптом (scripts/recommend.ts) — один прогон по всему
 * списку участников раз в месяц. На вход — полный ростер профилей, на выход —
 * для каждого целевого участника 3-5 рекомендованных с пояснением «почему».
 */

import { GoogleGenerativeAI, SchemaType, type GenerativeModel, type Schema } from '@google/generative-ai';

export interface RosterEntry {
  idx: number;
  name: string;
  niche?: string;
  city?: string;
  country?: string;
  bio?: string;
  goal?: string;
  expertise?: string;
  hobbies?: string;
  status?: string;
}

export interface RecommendationOut {
  /** idx целевого участника. */
  idx: number;
  recs: { recommended_idx: number; reason: string }[];
}

const SYSTEM_PROMPT = `Ты помогаешь участникам курса "AI-Ассистенты 3.0" находить полезные знакомства внутри потока.

На вход — список участников с профилями (ниша, цель, опыт, статус, город). Для каждого ЦЕЛЕВОГО участника подбери людей, с которыми ему максимально полезно познакомиться.

Критерии полезного знакомства:
- потенциальный клиент (целевой ищет клиентов — у кандидата задача, которую целевой решает);
- потенциальный партнёр (дополняющие навыки, можно делать проекты вместе);
- наставник / более опытный в нужной нише;
- схожая ниша или цель — обмен опытом;
- один город / страна — возможность встретиться оффлайн (как доп. фактор, не основной).

Для каждой рекомендации напиши reason — ОДНО короткое предложение по-русски, конкретно почему этим двоим стоит познакомиться. Без воды, обращайся к целевому участнику на "вы".

Правила:
- 3-5 рекомендаций на участника, самые сильные — первыми;
- не рекомендуй участника самому себе;
- рекомендуй только из присланного списка (по recommended_idx);
- если хороших кандидатов мало — лучше меньше, но точнее.`;

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      idx: { type: SchemaType.INTEGER },
      recs: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            recommended_idx: { type: SchemaType.INTEGER },
            reason: { type: SchemaType.STRING },
          },
          required: ['recommended_idx', 'reason'],
        },
      },
    },
    required: ['idx', 'recs'],
  },
};

export interface RecommendConfig {
  apiKey?: string;
  model?: string;
  /** Сколько целевых участников в одном запросе (ростер всегда передаётся целиком). */
  batchSize?: number;
  maxRetries?: number;
  onBatch?: (done: number, total: number) => void;
}

/**
 * @param roster  кандидаты, которых можно рекомендовать (только опубликованные).
 * @param targets участники, для которых генерируем рекомендации (могут быть и
 *                неопубликованные — например, только что вошедшие на сайт).
 */
export async function recommendConnections(
  roster: RosterEntry[],
  targets: RosterEntry[],
  config: RecommendConfig = {},
): Promise<RecommendationOut[]> {
  const apiKey = config.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required');

  const modelName = config.model ?? process.env.LLM_MODEL ?? 'gemini-2.5-flash';
  const batchSize = config.batchSize ?? 30;
  const maxRetries = config.maxRetries ?? 2;

  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.4,
      maxOutputTokens: 32768,
    },
  });

  const recommendableIdx = new Set(roster.map((r) => r.idx));
  const targetIdx = new Set(targets.map((t) => t.idx));
  const out: RecommendationOut[] = [];

  for (let i = 0; i < targets.length; i += batchSize) {
    const batchTargets = targets.slice(i, i + batchSize);
    const batch = await recommendBatch(
      model,
      roster,
      batchTargets,
      maxRetries,
      recommendableIdx,
      targetIdx,
    );
    out.push(...batch);
    config.onBatch?.(Math.min(i + batchSize, targets.length), targets.length);
  }
  return out;
}

async function recommendBatch(
  model: GenerativeModel,
  roster: RosterEntry[],
  targets: RosterEntry[],
  maxRetries: number,
  recommendableIdx: Set<number>,
  targetIdx: Set<number>,
): Promise<RecommendationOut[]> {
  const prompt = `СПИСОК ВСЕХ УЧАСТНИКОВ (можно рекомендовать только из них, по полю idx):
${JSON.stringify(roster, null, 1)}

ЦЕЛЕВЫЕ УЧАСТНИКИ — подбери рекомендации для каждого из этих idx:
${JSON.stringify(targets.map((t) => t.idx))}

Верни JSON-массив: для каждого целевого idx объект {idx, recs:[{recommended_idx, reason}]}.`;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await model.generateContent(prompt);
      const parsed = JSON.parse(response.response.text());
      if (!Array.isArray(parsed)) throw new Error('response is not an array');
      return sanitize(parsed, recommendableIdx, targetIdx);
    } catch (e) {
      lastError = e;
      if (attempt === maxRetries) break;
    }
  }
  throw new Error(`recommendBatch failed: ${String(lastError)}`);
}

function sanitize(
  parsed: unknown[],
  recommendableIdx: Set<number>,
  targetIdx: Set<number>,
): RecommendationOut[] {
  const out: RecommendationOut[] = [];
  for (const raw of parsed) {
    const item = raw as Record<string, unknown>;
    if (typeof item.idx !== 'number' || !targetIdx.has(item.idx)) continue;
    const recsRaw = Array.isArray(item.recs) ? item.recs : [];
    const seen = new Set<number>();
    const recs: RecommendationOut['recs'] = [];
    for (const r of recsRaw) {
      const rec = r as Record<string, unknown>;
      const ridx = rec.recommended_idx;
      const reason = rec.reason;
      if (typeof ridx !== 'number' || ridx === item.idx || !recommendableIdx.has(ridx)) continue;
      if (seen.has(ridx)) continue;
      seen.add(ridx);
      recs.push({
        recommended_idx: ridx,
        reason: typeof reason === 'string' ? reason.trim().slice(0, 300) : '',
      });
      if (recs.length >= 5) break;
    }
    if (recs.length > 0) out.push({ idx: item.idx, recs });
  }
  return out;
}
