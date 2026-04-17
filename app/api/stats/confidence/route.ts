export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { sql } from '@/lib/db'

export interface ConfidenceBucket {
  bucket: number      // нижняя граница: 50, 60, 70, 80, 90
  label: string       // '50–59%', '60–69%', ...
  total: number       // всего сигналов с outcome в этом диапазоне
  wins: number
  losses: number
  win_rate: number | null  // 0-100
  avg_pnl: number | null
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`
    SELECT
      FLOOR(final_confidence / 10) * 10                                   AS bucket,
      COUNT(*)                                                             AS total,
      COUNT(*) FILTER (WHERE outcome = 'win')                             AS wins,
      COUNT(*) FILTER (WHERE outcome = 'loss')                            AS losses,
      ROUND(
        COUNT(*) FILTER (WHERE outcome = 'win')::numeric
        / NULLIF(COUNT(*) FILTER (WHERE outcome IS NOT NULL), 0) * 100
      )                                                                    AS win_rate,
      ROUND(AVG(actual_pnl_pct)::numeric, 1)                             AS avg_pnl
    FROM signals
    WHERE user_id = ${user.id}
      AND outcome IS NOT NULL
      AND final_confidence IS NOT NULL
    GROUP BY bucket
    ORDER BY bucket
  `

  const LABELS: Record<number, string> = {
    50: '50–59%', 60: '60–69%', 70: '70–79%',
    80: '80–89%', 90: '90–95%',
  }

  const buckets: ConfidenceBucket[] = rows.map(r => ({
    bucket:   Number(r.bucket),
    label:    LABELS[Number(r.bucket)] ?? `${r.bucket}%+`,
    total:    Number(r.total),
    wins:     Number(r.wins),
    losses:   Number(r.losses),
    win_rate: r.win_rate != null ? Number(r.win_rate) : null,
    avg_pnl:  r.avg_pnl  != null ? Number(r.avg_pnl)  : null,
  }))

  return NextResponse.json({ ok: true, buckets })
}
