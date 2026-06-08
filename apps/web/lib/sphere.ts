/**
 * Точечное определение сферы ученика по нише/профилю — одна из УЖЕ существующих
 * сфер на витрине. Вызывается при сохранении профиля, чтобы новый ученик сразу
 * попадал под нужный чип «Сфера» (как регион определяется из города).
 *
 * Fail-soft: без GEMINI_API_KEY, при ошибке или таймауте возвращает null —
 * сохранение профиля от этого не страдает, сфера просто остаётся прежней.
 */

const MODEL = process.env.LLM_MODEL ?? 'gemini-2.5-flash';

export interface SphereProfile {
  niche?: string | null;
  bio?: string | null;
  goal?: string | null;
  expertise?: string | null;
}

export async function assignSphere(
  p: SphereProfile,
  spheres: string[],
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key || spheres.length === 0) return null;

  const niche = (p.niche ?? '').trim();
  const bio = (p.bio ?? '').trim();
  if (!niche && !bio) return null; // нет сигнала — не угадываем

  const base = process.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com';
  const prompt = `Выбери РОВНО ОДНУ сферу из списка, которая лучше всего описывает ученика. Ответь только её названием из списка, без пояснений и кавычек.

Сферы:
${spheres.map((s) => `- ${s}`).join('\n')}

Профиль:
ниша: ${niche || '—'}
о себе: ${bio || '—'}
цель: ${(p.goal ?? '').trim() || '—'}
опыт: ${(p.expertise ?? '').trim() || '—'}`;

  try {
    const res = await fetch(
      `${base}/v1beta/models/${MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 30 },
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim().toLowerCase();
    if (!text) return null;
    // Берём сферу, чьё название совпало с ответом (в любую сторону).
    return (
      spheres.find((s) => {
        const l = s.toLowerCase();
        return text.includes(l) || l.includes(text);
      }) ?? null
    );
  } catch {
    return null;
  }
}
