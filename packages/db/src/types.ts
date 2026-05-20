// Типы соответствуют миграции 0001_init.sql.
// При расширении схемы — обновить здесь и в clients (parser/import/bot).

export type StudentStatus =
  | 'looking_for_clients'
  | 'looking_for_partners'
  | 'just_learning';

export type MediaItem =
  | { type: 'image'; url: string; caption?: string }
  | { type: 'video'; url: string; caption?: string; duration?: number }
  | { type: 'pdf'; url: string; caption?: string }
  | { type: 'link'; url: string; caption?: string };

export interface Student {
  id: string;
  telegram_user_id: number | null;
  telegram_username: string | null;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  niche: string | null;
  /** Широкая категория (Маркетинг, Продажи, ...). Заполняется scripts/spheres.ts. */
  sphere: string | null;
  bio: string | null;
  goal: string | null;
  expertise: string | null;
  hobbies: string | null;
  age: number | null;
  status: StudentStatus | null;
  is_published: boolean;
  cohort: string;
  source_message_id: string | null;
  import_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface Work {
  id: string;
  student_id: string;
  title: string;
  description: string | null;
  media: MediaItem[];
  tags: string[];
  source_message_id: string | null;
  posted_at: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export type RawMessageClass = 'intro' | 'work' | 'qa' | 'chat';

export interface RawMessage {
  id: string;
  thread_id: number | null;
  author_tg_id: number | null;
  author_name: string | null;
  text: string | null;
  media: MediaItem[] | null;
  posted_at: string | null;
  classified_as: RawMessageClass | null;
  processed_at: string | null;
  ingested_from: 'html_export' | 'bot_pull';
}

export interface Tag {
  slug: string;
  label: string;
  type: 'niche' | 'skill' | 'work_category';
}

export interface Recommendation {
  student_id: string;
  recommended_id: string;
  reason: string | null;
  rank: number;
  created_at: string;
}
