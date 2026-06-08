export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAllPendingSignals, getAllPendingTrades, getAllOpenTrades, sql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.AUTO_ANALYZE_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [pending, pendingTrades, openTrades] = await Promise.all([
    getAllPendingSignals(),
    getAllPendingTrades(),
    getAllOpenTrades(),
  ])

  const dbHost = await sql`SELECT inet_server_addr() as addr, current_database() as db, NOW() as now`

  return NextResponse.json({
    ok: true,
    db: dbHost[0],
    pendingSignals: pending.map(s => ({ id: s.id, user_id: s.user_id, pair: s.pair, timeframe: s.timeframe, final_verdict: s.final_verdict, outcome: s.outcome, created_at: s.created_at })),
    pendingTrades: pendingTrades.map(t => ({ id: t.id, user_id: t.user_id, pair: t.pair, direction: t.direction, status: t.status, account_type: t.account_type, created_at: t.created_at })),
    openTrades: openTrades.map(t => ({ id: t.id, user_id: t.user_id, pair: t.pair, direction: t.direction, status: t.status, account_type: t.account_type, created_at: t.created_at })),
  })
}
