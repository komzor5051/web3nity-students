/**
 * Persistent FSM, хранится в bot_sessions (Postgres).
 * Состояния — для мастеров /edit и /work_add.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { tbl } from '@web3nity/db';

export type EditField =
  | 'display_name'
  | 'city'
  | 'country'
  | 'niche'
  | 'bio'
  | 'goal'
  | 'expertise'
  | 'hobbies'
  | 'age'
  | 'status';

export type SessionState =
  | { kind: 'idle' }
  | { kind: 'awaiting_consent' }
  | { kind: 'edit_field'; field: EditField }
  | { kind: 'work_title' }
  | { kind: 'work_description'; title: string }
  | { kind: 'work_media'; title: string; description: string; media: { type: string; url: string; caption?: string }[] }
  | { kind: 'work_tags'; title: string; description: string; media: { type: string; url: string; caption?: string }[] };

export async function getSession(db: SupabaseClient, tgId: number): Promise<SessionState> {
  const { data } = await db
    .from(tbl('bot_sessions'))
    .select('state, context')
    .eq('telegram_user_id', tgId)
    .maybeSingle();
  if (!data || !data.state) return { kind: 'idle' };
  try {
    return JSON.parse(data.state) as SessionState;
  } catch {
    return { kind: 'idle' };
  }
}

export async function setSession(
  db: SupabaseClient,
  tgId: number,
  state: SessionState,
): Promise<void> {
  const payload = {
    telegram_user_id: tgId,
    state: JSON.stringify(state),
    context: {},
    updated_at: new Date().toISOString(),
  };
  const { error } = await db
    .from(tbl('bot_sessions'))
    .upsert(payload, { onConflict: 'telegram_user_id' });
  if (error) throw error;
}

export async function clearSession(db: SupabaseClient, tgId: number): Promise<void> {
  await setSession(db, tgId, { kind: 'idle' });
}
