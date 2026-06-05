import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  await destroySession();
  // Относительный Location: браузер резолвит его от публичного домена,
  // с которого пришёл POST. Не используем req.url — за прокси Railway он
  // содержит внутренний хост 0.0.0.0 и ломает редирект.
  return new NextResponse(null, { status: 303, headers: { Location: '/students' } });
}
