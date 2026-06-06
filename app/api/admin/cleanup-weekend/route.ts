export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.AUTO_ANALYZE_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const from = `${date} 00:00:00`

  const deletedSignals = await sql`
    DELETE FROM signals
    WHERE created_at >= ${from}::timestamptz
    RETURNING id, pair, timeframe, final_verdict
  `

  const deletedTrades = await sql`
    DELETE FROM trades
    WHERE account_type = 'ai'
      AND created_at >= ${from}::timestamptz
      AND status IN ('pending', 'open')
    RETURNING id, pair, direction
  `

  return NextResponse.json({
    ok: true,
    date,
    signals_deleted: deletedSignals.length,
    trades_deleted: deletedTrades.length,
    signals: deletedSignals,
    trades: deletedTrades,
  })
}
