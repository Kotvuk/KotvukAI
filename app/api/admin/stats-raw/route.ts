export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.AUTO_ANALYZE_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [overall, byPair, byTf, recent] = await Promise.all([
    sql`
      SELECT
        COUNT(*) FILTER (WHERE outcome IS NOT NULL) AS resolved,
        COUNT(*) FILTER (WHERE outcome = 'win') AS wins,
        COUNT(*) FILTER (WHERE outcome = 'loss') AS losses,
        COUNT(*) FILTER (WHERE outcome IS NULL AND final_verdict IN ('LONG','SHORT')) AS pending,
        ROUND(
          COUNT(*) FILTER (WHERE outcome = 'win') * 100.0 /
          NULLIF(COUNT(*) FILTER (WHERE outcome IS NOT NULL), 0), 1
        ) AS win_rate,
        ROUND(AVG(actual_pnl_pct) FILTER (WHERE outcome IS NOT NULL AND actual_pnl_pct IS NOT NULL AND actual_pnl_pct != 'NaN'), 2) AS avg_pnl,
        ROUND(AVG(actual_pnl_pct) FILTER (WHERE outcome = 'win' AND actual_pnl_pct IS NOT NULL), 2) AS avg_win,
        ROUND(AVG(actual_pnl_pct) FILTER (WHERE outcome = 'loss' AND actual_pnl_pct IS NOT NULL), 2) AS avg_loss
      FROM signals
      WHERE final_verdict IN ('LONG','SHORT')
        AND created_at > NOW() - INTERVAL '30 days'
    `,
    sql`
      SELECT
        pair,
        COUNT(*) FILTER (WHERE outcome IS NOT NULL) AS resolved,
        COUNT(*) FILTER (WHERE outcome = 'win') AS wins,
        ROUND(COUNT(*) FILTER (WHERE outcome = 'win') * 100.0 / NULLIF(COUNT(*) FILTER (WHERE outcome IS NOT NULL), 0), 0) AS wr,
        ROUND(AVG(actual_pnl_pct) FILTER (WHERE outcome IS NOT NULL AND actual_pnl_pct IS NOT NULL AND actual_pnl_pct != 'NaN'), 2) AS avg_pnl
      FROM signals
      WHERE final_verdict IN ('LONG','SHORT')
        AND created_at > NOW() - INTERVAL '30 days'
        AND outcome IS NOT NULL
      GROUP BY pair
      HAVING COUNT(*) FILTER (WHERE outcome IS NOT NULL) >= 3
      ORDER BY wr DESC, resolved DESC
      LIMIT 15
    `,
    sql`
      SELECT
        timeframe,
        COUNT(*) FILTER (WHERE outcome IS NOT NULL) AS resolved,
        COUNT(*) FILTER (WHERE outcome = 'win') AS wins,
        ROUND(COUNT(*) FILTER (WHERE outcome = 'win') * 100.0 / NULLIF(COUNT(*) FILTER (WHERE outcome IS NOT NULL), 0), 0) AS wr,
        ROUND(AVG(actual_pnl_pct) FILTER (WHERE outcome IS NOT NULL AND actual_pnl_pct IS NOT NULL AND actual_pnl_pct != 'NaN'), 2) AS avg_pnl
      FROM signals
      WHERE final_verdict IN ('LONG','SHORT')
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY timeframe
      ORDER BY resolved DESC
    `,
    sql`
      SELECT id, pair, timeframe, final_verdict, outcome, actual_pnl_pct, created_at
      FROM signals
      WHERE final_verdict IN ('LONG','SHORT') AND outcome IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10
    `,
  ])

  return NextResponse.json({
    ok: true,
    overall: overall[0],
    byPair,
    byTimeframe: byTf,
    recentSignals: recent,
  })
}
