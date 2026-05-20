import { NextResponse, type NextRequest } from 'next/server';
import { destroySession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  await destroySession();
  return NextResponse.redirect(new URL('/students', req.url), { status: 303 });
}
