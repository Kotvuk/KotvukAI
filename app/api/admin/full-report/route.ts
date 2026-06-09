export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.AUTO_ANALYZE_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [overall, byTf, byPair, byVerdict, users, trades, recentWins, recentLosses] = await Promise.all([
    sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE outcome IS NOT NULL) AS resolved,
        COUNT(*) FILTER (WHERE outcome = 'win') AS wins,
        COUNT(*) FILTER (WHERE outcome = 'loss') AS losses,
        COUNT(*) FILTER (WHERE outcome IS NULL AND final_verdict IN ('LONG','SHORT')) AS pending,
        ROUND(COUNT(*) FILTER (WHERE outcome = 'win') * 100.0 /
          NULLIF(COUNT(*) FILTER (WHERE outcome IS NOT NULL), 0), 1) AS win_rate,
        ROUND(AVG(actual_pnl_pct) FILTER (WHERE outcome IS NOT NULL AND actual_pnl_pct IS NOT NULL AND actual_pnl_pct != 'NaN'), 2) AS avg_pnl,
        ROUND(AVG(actual_pnl_pct) FILTER (WHERE outcome = 'win' AND actual_pnl_pct IS NOT NULL), 2) AS avg_win,
        ROUND(AVG(actual_pnl_pct) FILTER (WHERE outcome = 'loss' AND actual_pnl_pct IS NOT NULL), 2) AS avg_loss,
        ROUND(MAX(actual_pnl_pct) FILTER (WHERE outcome = 'win'), 2) AS best_trade,
        ROUND(MIN(actual_pnl_pct) FILTER (WHERE outcome = 'loss'), 2) AS worst_trade,
        MIN(created_at) AS first_signal,
        MAX(created_at) AS last_signal
      FROM signals
      WHERE final_verdict IN ('LONG','SHORT')
    `,
    sql`
      SELECT timeframe,
        COUNT(*) FILTER (WHERE outcome IS NOT NULL) AS resolved,
        COUNT(*) FILTER (WHERE outcome = 'win') AS wins,
        ROUND(COUNT(*) FILTER (WHERE outcome = 'win') * 100.0 /
          NULLIF(COUNT(*) FILTER (WHERE outcome IS NOT NULL), 0), 0) AS wr,
        ROUND(AVG(actual_pnl_pct) FILTER (WHERE outcome IS NOT NULL AND actual_pnl_pct IS NOT NULL AND actual_pnl_pct != 'NaN'), 2) AS avg_pnl
      FROM signals
      WHERE final_verdict IN ('LONG','SHORT') AND outcome IS NOT NULL
      GROUP BY timeframe
      ORDER BY resolved DESC
    `,
    sql`
      SELECT pair,
        COUNT(*) FILTER (WHERE outcome IS NOT NULL) AS resolved,
        COUNT(*) FILTER (WHERE outcome = 'win') AS wins,
        ROUND(COUNT(*) FILTER (WHERE outcome = 'win') * 100.0 /
          NULLIF(COUNT(*) FILTER (WHERE outcome IS NOT NULL), 0), 0) AS wr,
        ROUND(AVG(actual_pnl_pct) FILTER (WHERE outcome IS NOT NULL AND actual_pnl_pct IS NOT NULL AND actual_pnl_pct != 'NaN'), 2) AS avg_pnl
      FROM signals
      WHERE final_verdict IN ('LONG','SHORT') AND outcome IS NOT NULL
      GROUP BY pair
      ORDER BY resolved DESC
      LIMIT 20
    `,
    sql`
      SELECT final_verdict,
        COUNT(*) FILTER (WHERE outcome IS NOT NULL) AS resolved,
        COUNT(*) FILTER (WHERE outcome = 'win') AS wins,
        ROUND(COUNT(*) FILTER (WHERE outcome = 'win') * 100.0 /
          NULLIF(COUNT(*) FILTER (WHERE outcome IS NOT NULL), 0), 0) AS wr
      FROM signals
      WHERE final_verdict IN ('LONG','SHORT') AND outcome IS NOT NULL
      GROUP BY final_verdict
    `,
    sql`SELECT COUNT(*) AS total FROM users`,
    sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE account_type = 'ai') AS ai_trades,
        COUNT(*) FILTER (WHERE account_type = 'user') AS user_trades,
        COUNT(*) FILTER (WHERE status = 'closed' AND pnl_pct > 0 AND account_type = 'ai') AS ai_wins,
        COUNT(*) FILTER (WHERE status = 'closed' AND pnl_pct <= 0 AND account_type = 'ai') AS ai_losses,
        ROUND(AVG(pnl_pct) FILTER (WHERE status = 'closed' AND account_type = 'ai' AND pnl_pct IS NOT NULL), 2) AS ai_avg_pnl
      FROM trades
    `,
    sql`
      SELECT pair, timeframe, final_verdict, actual_pnl_pct, created_at
      FROM signals
      WHERE outcome = 'win' AND actual_pnl_pct IS NOT NULL
      ORDER BY actual_pnl_pct DESC
      LIMIT 5
    `,
    sql`
      SELECT pair, timeframe, final_verdict, actual_pnl_pct, created_at
      FROM signals
      WHERE outcome = 'loss' AND actual_pnl_pct IS NOT NULL
      ORDER BY actual_pnl_pct ASC
      LIMIT 5
    `,
  ])

  return NextResponse.json({ ok: true, overall: overall[0], byTimeframe: byTf, byPair, byVerdict, users: users[0], trades: trades[0], topWins: recentWins, topLosses: recentLosses })
}
