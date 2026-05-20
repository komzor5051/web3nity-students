import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { pollAuthToken, setSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ status: 'expired' }, { status: 400 });

  const result = await pollAuthToken(token);
  if (result.status === 'confirmed') {
    const jar = await cookies();
    setSessionCookie(jar, result.sessionId);
    return NextResponse.json({ status: 'confirmed' });
  }
  return NextResponse.json({ status: result.status });
}
