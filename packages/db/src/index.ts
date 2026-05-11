import { createClient, SupabaseClient } from '@supabase/supabase-js';

export * from './types.js';

let _service: SupabaseClient | null = null;
let _anon: SupabaseClient | null = null;

/**
 * Префикс имён таблиц. Пусто = выделенный проект (каноничная схема из миграции).
 * `web3nity_` = временное размещение в общем проекте lvmn-hub.
 */
export const TABLE_PREFIX = process.env.SUPABASE_TABLE_PREFIX ?? '';
/** Префикс имён storage-бакетов (бакеты глобальны на проект). */
export const BUCKET_PREFIX = process.env.SUPABASE_BUCKET_PREFIX ?? '';

export function tbl(name: string): string {
  return TABLE_PREFIX + name;
}
export function bucket(name: string): string {
  return BUCKET_PREFIX + name;
}

export function getServiceClient(): SupabaseClient {
  if (_service) return _service;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  _service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _service;
}

export function getAnonClient(): SupabaseClient {
  if (_anon) return _anon;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
  _anon = createClient(url, key, { auth: { persistSession: false } });
  return _anon;
}
