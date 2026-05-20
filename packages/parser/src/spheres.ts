/**
 * LLM-классификация участников по широким сферам деятельности.
 *
 * Один прогон по всему списку: модель сначала выбирает 5-7 самых ёмких сфер,
 * затем присваивает каждому участнику ровно одну. Используется батч-скриптом
 * scripts/spheres.ts (раз в месяц вручную).
 */

import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';

export interface SphereInput {
  idx: number;
  name: string;
  niche?: string;
  bio?: string;
  expertise?: string;
  goal?: string;
}

export interface SphereResult {
  /** 5-7 канонических сфер. */
  spheres: string[];
  /** idx участника → название сферы (одно из spheres). */
  assignments: { idx: number; sphere: string }[];
}

const SYSTEM_PROMPT = `Ты группируешь участников курса "AI-Ассистенты 3.0" по сфере деятельности.

Задача в два шага:
1. По всему списку участников определи от 5 до 7 САМЫХ ЁМКИХ сфер, которые покрывают большинство людей. Сферы должны быть широкими и понятными — например: "Маркетинг", "Продажи", "Разработка и AI", "Услуги и консалтинг", "E-commerce и товарка", "Образование", "Финансы и инвестиции". Не дроби на узкие категории: копирайтер, SMM-щик, таргетолог — это всё "Маркетинг".
2. Каждому участнику присвой РОВНО ОДНУ сферу из получившегося списка — ту, что лучше всего описывает его основную деятельность.

Правила:
- названия сфер короткие (1-3 слова), по-русски, с заглавной буквы;
- каждый участник обязан получить сферу, даже если профиль скупой — выбери ближайшую по смыслу;
- assignments должен содержать по одной записи на каждый присланный idx;
- sphere в assignments — строго из списка spheres.`;

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    spheres: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    assignments: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          idx: { type: SchemaType.INTEGER },
          sphere: { type: SchemaType.STRING },
        },
        required: ['idx', 'sphere'],
      },
    },
  },
  required: ['spheres', 'assignments'],
};

export interface SphereConfig {
  apiKey?: string;
  model?: string;
  maxRetries?: number;
}

export async function classifySpheres(
  students: SphereInput[],
  config: SphereConfig = {},
): Promise<SphereResult> {
  const apiKey = config.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is required');

  const modelName = config.model ?? process.env.LLM_MODEL ?? 'gemini-2.5-flash';
  const maxRetries = config.maxRetries ?? 2;

  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.3,
      maxOutputTokens: 16384,
    },
  });

  const prompt = `УЧАСТНИКИ (${students.length}):
${JSON.stringify(students, null, 1)}

Верни JSON-объект {spheres: string[], assignments: [{idx, sphere}]}.`;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await model.generateContent(prompt);
      const parsed = JSON.parse(response.response.text()) as Record<string, unknown>;
      return sanitize(parsed, students);
    } catch (e) {
      lastError = e;
      if (attempt === maxRetries) break;
    }
  }
  throw new Error(`classifySpheres failed: ${String(lastError)}`);
}

function sanitize(parsed: Record<string, unknown>, students: SphereInput[]): SphereResult {
  const spheres = Array.isArray(parsed.spheres)
    ? parsed.spheres.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
    : [];
  if (spheres.length === 0) throw new Error('no spheres returned');

  const sphereSet = new Set(spheres);
  const validIdx = new Set(students.map((s) => s.idx));
  const assignments: SphereResult['assignments'] = [];
  const seen = new Set<number>();

  const rawAssignments = Array.isArray(parsed.assignments) ? parsed.assignments : [];
  for (const raw of rawAssignments) {
    const a = raw as Record<string, unknown>;
    if (typeof a.idx !== 'number' || !validIdx.has(a.idx) || seen.has(a.idx)) continue;
    if (typeof a.sphere !== 'string' || !sphereSet.has(a.sphere)) continue;
    seen.add(a.idx);
    assignments.push({ idx: a.idx, sphere: a.sphere });
  }
  return { spheres, assignments };
}
