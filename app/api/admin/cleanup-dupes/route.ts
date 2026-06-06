export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.AUTO_ANALYZE_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const deleted = await sql`
    DELETE FROM signals
    WHERE id NOT IN (
      SELECT DISTINCT ON (pair, timeframe, DATE(created_at)) id
      FROM signals
      ORDER BY pair, timeframe, DATE(created_at), created_at ASC
    )
    RETURNING id, pair, timeframe, final_verdict, created_at
  `

  return NextResponse.json({
    ok: true,
    deleted: deleted.length,
    signals: deleted,
  })
}
