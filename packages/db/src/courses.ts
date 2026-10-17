// Реестр курсов платформы: единственный источник правды для сайта, бота и скриптов.
// Без импортов и обращений к env — годится и серверу, и скриптам, и тестам.

export const COURSE_IDS = ['vibecoding', 'assistants'] as const;
export type CourseId = (typeof COURSE_IDS)[number];

export interface Course {
  id: CourseId;
  title: string;
  /** Надзаголовок страниц курса (eyebrow). */
  eyebrow: string;
  /** Метка потока для новых анкет, заведённых при входе (импорт ставит свою). */
  defaultCohort: string;
  /** Telegram-чаты курса: участники этих чатов — ученики курса. */
  chatIds: number[];
}

// Порядок важен: первым идёт курс по умолчанию (редиректы, старые ссылки).
export const COURSES: Course[] = [
  {
    id: 'vibecoding',
    title: 'Вайбкодинг',
    eyebrow: 'Практикум «Вайбкодинг»',
    defaultCohort: 'vibecoding-main',
    chatIds: [-1004353204500, -1004413372752, -1003966609206, -1003709866237],
  },
  {
    id: 'assistants',
    title: 'AI-ассистенты',
    eyebrow: 'AI-ассистенты и агенты',
    defaultCohort: 'assistants-main',
    // «AI-АССИСТЕНТЫ 3.0» и «AI-Ассистенты | VIP».
    chatIds: [-1003764026898, -1003803830627],
  },
];

export const DEFAULT_COURSE: CourseId = 'vibecoding';

export function isCourseId(value: unknown): value is CourseId {
  return typeof value === 'string' && (COURSE_IDS as readonly string[]).includes(value);
}

/** Курс по значению из URL или null, если такого курса нет. */
export function getCourse(value: unknown): Course | null {
  return COURSES.find((c) => c.id === value) ?? null;
}

/** Курс, которому принадлежит чат. null — чат не входит ни в один курс. */
export function courseOfChat(chatId: number): CourseId | null {
  return COURSES.find((c) => c.chatIds.includes(chatId))?.id ?? null;
}

/** Курсы человека по списку его чатов, в порядке реестра. */
export function coursesOfChats(chatIds: number[]): CourseId[] {
  return COURSES.filter((c) => c.chatIds.some((id) => chatIds.includes(id))).map((c) => c.id);
}
