export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.AUTO_ANALYZE_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ids = req.nextUrl.searchParams.get('ids')
  if (ids) {
    const idList = ids.split(',').map(s => Number(s.trim())).filter(Number.isFinite)
    const deleted = await sql`DELETE FROM trades WHERE id = ANY(${idList}) RETURNING id, pair, direction, status, pnl, pnl_pct, closed_at`
    return NextResponse.json({ ok: true, deleted })
  }

  const rows = await sql`
    SELECT id, user_id, pair, direction, status, account_type, pnl, pnl_pct, closed_at, created_at
    FROM trades
    WHERE status = 'closed'
      AND (
        (pair = 'LTC/USDT' AND direction = 'long') OR
        (pair = 'BTC/USDT' AND direction = 'long') OR
        (pair = 'DOGE/USDT' AND direction = 'short')
      )
    ORDER BY closed_at DESC
    LIMIT 50
  `
  return NextResponse.json({ ok: true, candidates: rows })
}
