import { NextResponse } from 'next/server';
import { createAuthToken, botUsername } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const bot = botUsername();
  if (!bot) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_TELEGRAM_BOT_USERNAME not configured' },
      { status: 500 },
    );
  }
  const { token, deepLink } = await createAuthToken();
  return NextResponse.json({ token, deepLink });
}
