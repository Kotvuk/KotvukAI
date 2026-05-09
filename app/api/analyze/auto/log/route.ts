export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { sql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim())
  if (!adminEmails.includes(user.email || '')) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  const rows = await sql`
    SELECT
      s.id, s.pair, s.timeframe, s.final_verdict, s.final_confidence,
      s.final_entry, s.final_tp, s.final_sl, s.final_leverage,
      s.outcome, s.actual_pnl_pct, s.created_at,
      u.email
    FROM signals s
    JOIN users u ON u.id = s.user_id
    WHERE u.email = ANY(${adminEmails})
      AND s.created_at > NOW() - INTERVAL '48 hours'
    ORDER BY s.created_at DESC
    LIMIT 100
  `

  const now = Date.now()
  const oneHour = 3_600_000

  const summary = {
    total:  rows.length,
    long:   rows.filter(r => r.final_verdict === 'LONG').length,
    short:  rows.filter(r => r.final_verdict === 'SHORT').length,
    wait:   rows.filter(r => r.final_verdict === 'WAIT').length,
    wins:   rows.filter(r => r.outcome === 'win').length,
    losses: rows.filter(r => r.outcome === 'loss').length,
    lastRunAgo: rows.length > 0
      ? Math.round((now - new Date(rows[0].created_at as string).getTime()) / 60000)
      : null,
    activeSignals: rows.filter(r =>
      (r.final_verdict === 'LONG' || r.final_verdict === 'SHORT') &&
      !r.outcome &&
      (now - new Date(r.created_at as string).getTime()) < 7 * 24 * oneHour
    ).length,
  }

  return NextResponse.json({ ok: true, summary, signals: rows })
}
