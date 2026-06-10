export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { getPendingSignals, setSignalOutcome, expireOldSignals, createNotification } from '@/lib/db'
import { getUser } from '@/lib/auth-helper'

const TF_MAP: Record<string, string> = {
  '1м': '1m', '5м': '5m', '15м': '15m', '30м': '30m',
  '1ч': '1h', '4ч': '4h', '1д': '1d',
  '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '4h': '4h', '1d': '1d',
}

async function fetchCandlesSince(sym: string, interval: string, sinceMs: number): Promise<{ high: number; low: number; close: number }[]> {
  const intervalMs: Record<string, number> = {
    '1m': 60_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000, '1h': 3_600_000, '4h': 14_400_000,
  }
  const candleMs = intervalMs[interval] ?? 3_600_000
  const clampedMs = Math.max(sinceMs, Date.now() - candleMs * 200)
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${interval}&startTime=${clampedMs}&limit=200`
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t))
  if (!res.ok) return []
  const raw: number[][] = await res.json()
  return raw.map(c => ({
    high:  parseFloat(String(c[2])),
    low:   parseFloat(String(c[3])),
    close: parseFloat(String(c[4])),
  }))
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  await expireOldSignals()

  const pendingSignals = await getPendingSignals(user.id)
  const results: { id: number; outcome: string; pnlPct: number }[] = []

  for (const signal of pendingSignals) {
    if (!signal.final_tp || !signal.final_sl || !signal.final_entry || !signal.final_verdict) continue

    const sym      = signal.pair.replace('/', '')
    const interval = TF_MAP[signal.timeframe] || '1h'
    const sinceMs  = new Date(signal.created_at).getTime()

    try {
      const candles = await fetchCandlesSince(sym, interval, sinceMs)
      if (!candles.length) continue

      const isLong  = signal.final_verdict === 'LONG'
      const entry   = signal.final_entry
      const tp      = signal.final_tp
      const sl      = signal.final_sl
      const leverage = signal.final_leverage ?? 1

      let hitTp = false
      let hitSl = false

      for (const c of candles) {
        const tpTouch = isLong ? c.high >= tp : c.low  <= tp
        const slTouch = isLong ? c.low  <= sl : c.high >= sl
        if (tpTouch && slTouch) { hitSl = true; break }
        if (tpTouch) { hitTp = true; break }
        if (slTouch) { hitSl = true; break }
      }

      if (!hitTp && !hitSl) continue

      const outcome: 'win' | 'loss' = hitTp ? 'win' : 'loss'
      const price    = hitTp ? tp : sl
      const priceDiff = isLong ? price - entry : entry - price
      const pnlPct   = parseFloat(((priceDiff / entry) * leverage * 100).toFixed(2))

      const outcomeRows = await setSignalOutcome(signal.id, outcome, pnlPct, user.id)
      if (!outcomeRows.length) continue

      const emoji  = outcome === 'win' ? '✅' : '❌'
      const pnlStr = pnlPct > 0 ? `+${pnlPct}%` : `${pnlPct}%`
      await createNotification(user.id, `${emoji} ${signal.final_verdict} ${signal.pair} ${signal.timeframe} — ${outcome === 'win' ? 'TP hit' : 'SL hit'} (${pnlStr})`)

      results.push({ id: signal.id, outcome, pnlPct })
    } catch {
    }
  }

  return NextResponse.json({ ok: true, checked: pendingSignals.length, updated: results.length, results })
}
