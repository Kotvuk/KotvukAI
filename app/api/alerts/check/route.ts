export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { checkAndTriggerAlerts, getLevelAlerts } from '@/lib/db'

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const alerts = await getLevelAlerts(user.id)
  if (!alerts.length) return NextResponse.json({ ok: true, triggered: 0 })

  const pairs = Array.from(new Set(alerts.map(a => a.pair)))
  const prices: Record<string, number> = {}

  await Promise.allSettled(pairs.map(async (pair) => {
    try {
      const symbol = pair.replace('/', '')
      const r = await fetch(
        `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (r.ok) {
        const d = await r.json() as { price: string }
        prices[pair] = parseFloat(d.price)
      }
    } catch {}
  }))

  const triggered = await checkAndTriggerAlerts(user.id, prices)
  return NextResponse.json({ ok: true, triggered })
}
