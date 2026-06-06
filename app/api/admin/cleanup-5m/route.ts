export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.AUTO_ANALYZE_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const signals = await sql`
    DELETE FROM signals
    WHERE timeframe IN ('5m', '5м', '1m', '1м')
    RETURNING id, pair, timeframe, final_verdict
  `

  const trades = await sql`
    DELETE FROM trades
    WHERE account_type = 'ai'
      AND status IN ('pending', 'open')
    RETURNING id, pair, direction, status
  `

  return NextResponse.json({
    ok: true,
    signals_deleted: signals.length,
    trades_deleted: trades.length,
    trades,
  })
}
