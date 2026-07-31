import { ImageResponse } from 'next/og';
import { supabase, studentSlug, tbl, type StudentRow } from '@/lib/db';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };
export const alt = 'Student profile';

export default async function OG({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const all = await supabase
    .from(tbl('students'))
    .select('id,display_name,niche,country,city,telegram_username,is_published')
    .eq('is_published', true);
  const s = (all.data as StudentRow[] | null)?.find((x) => studentSlug(x) === slug);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#FAFAF8',
          color: '#1A1A18',
          padding: 64,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 4, textTransform: 'uppercase', color: '#6B6860' }}>
          ВАЙБ-КОДИНГ
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
              fontFamily: 'monospace',
            }}
          >
            {s?.display_name ?? 'Ученик'}
          </div>
          <div style={{ fontSize: 36, marginTop: 16, color: '#6B6860' }}>
            {[s?.niche, s?.city || s?.country].filter(Boolean).join(' · ') || ' '}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
