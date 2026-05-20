export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'

function detectTimeframes(): string[] {
  const now  = new Date()
  const min  = now.getUTCMinutes()
  const hour = now.getUTCHours()
  const tfs  = ['5m']
  if (min % 15 === 0) tfs.push('15m')
  if (min % 30 === 0) tfs.push('30m')
  if (min === 0)                        tfs.push('1h')
  if (min === 0 && hour % 4 === 0)      tfs.push('4h')
  return tfs
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.AUTO_ANALYZE_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const base = (process.env.APP_URL ?? '').replace(/\/$/, '')
  const s    = process.env.AUTO_ANALYZE_SECRET!
  const tfs  = detectTimeframes()

  await Promise.allSettled(
    tfs.flatMap(tf =>
      [0, 1, 2].map(batch =>
        fetch(`${base}/api/analyze/auto?secret=${s}&batch=${batch}&tf=${tf}`, {
          signal: AbortSignal.timeout(55_000),
        }).catch(() => null)
      )
    )
  )

  const check = await fetch(`${base}/api/signals/auto-check?secret=${s}`, {
    signal: AbortSignal.timeout(55_000),
  })
    .then(r => r.json())
    .catch(() => ({ ok: false }))

  return NextResponse.json({ ok: true, tfs, signals: check })
}
