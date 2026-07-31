import { ImageResponse } from 'next/og';
import { supabase, tbl, type StudentRow, type WorkRow } from '@/lib/db';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };
export const alt = 'Работа ученика';

export default async function OG({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: work } = await supabase
    .from(tbl('works'))
    .select('id, student_id, title, is_published')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle<Pick<WorkRow, 'id' | 'student_id' | 'title' | 'is_published'>>();

  let author: Pick<StudentRow, 'display_name'> | null = null;
  if (work) {
    const { data } = await supabase
      .from(tbl('students'))
      .select('display_name')
      .eq('id', work.student_id)
      .maybeSingle<Pick<StudentRow, 'display_name'>>();
    author = data;
  }

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
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: -1,
              fontFamily: 'monospace',
            }}
          >
            {work?.title ?? 'Работа'}
          </div>
          <div style={{ fontSize: 32, marginTop: 16, color: '#6B6860' }}>
            {author?.display_name ?? ' '}
          </div>
        </div>
        <div style={{ height: 8, width: '100%', background: '#1F3A5F' }} />
      </div>
    ),
    size,
  );
}
