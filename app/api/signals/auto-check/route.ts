export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { getAllPendingSignals, expireOldSignals, setSignalOutcome, createNotification } from '@/lib/db'
import { sendTelegram } from '@/lib/telegram'

async function fetchCandles(sym: string, sinceMs: number): Promise<{ high: number; low: number }[]> {
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=1h&startTime=${sinceMs}&limit=200`
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(t)
    if (!res.ok) return []
    const raw: number[][] = await res.json()
    return raw.map(c => ({ high: parseFloat(String(c[2])), low: parseFloat(String(c[3])) }))
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.AUTO_ANALYZE_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const expired = await expireOldSignals()
  const pending = await getAllPendingSignals()

  if (!pending.length) {
    return NextResponse.json({ ok: true, expired, checked: 0, updated: 0 })
  }

  const pairGroups: Record<string, typeof pending> = {}
  for (const sig of pending) {
    const key = sig.pair.replace('/', '')
    if (!pairGroups[key]) pairGroups[key] = []
    pairGroups[key].push(sig)
  }

  let updated = 0

  for (const sym of Object.keys(pairGroups)) {
    const signals = pairGroups[sym]
    const oldestMs = Math.min(...signals.map(s => new Date(s.created_at).getTime()))
    const candles  = await fetchCandles(sym, oldestMs)
    if (!candles.length) continue

    const hourMs = 3_600_000

    for (const signal of signals) {
      if (!signal.final_tp || !signal.final_sl || !signal.final_entry || !signal.final_verdict) continue

      const sigStartMs = new Date(signal.created_at).getTime()
      const startIdx   = Math.max(0, Math.floor((sigStartMs - oldestMs) / hourMs))
      const slice      = candles.slice(startIdx)
      if (!slice.length) continue

      const isLong   = signal.final_verdict === 'LONG'
      const tp       = signal.final_tp
      const sl       = signal.final_sl
      const entry    = signal.final_entry
      const leverage = signal.final_leverage ?? 1

      let hitTp = false
      let hitSl = false

      for (const c of slice) {
        if (hitTp || hitSl) break
        if (isLong) {
          if (c.high >= tp) { hitTp = true; break }
          if (c.low  <= sl) { hitSl = true; break }
        } else {
          if (c.low  <= tp) { hitTp = true; break }
          if (c.high >= sl) { hitSl = true; break }
        }
      }

      if (!hitTp && !hitSl) continue

      const outcome: 'win' | 'loss' = hitTp ? 'win' : 'loss'
      const hitPrice = hitTp ? tp : sl
      const diff     = isLong ? hitPrice - entry : entry - hitPrice
      const pnlPct   = parseFloat(((diff / entry) * leverage * 100).toFixed(2))

      await setSignalOutcome(signal.id, outcome, pnlPct, signal.user_id)

      const emoji  = outcome === 'win' ? '✅' : '❌'
      const pnlStr = pnlPct >= 0 ? `+${pnlPct}%` : `${pnlPct}%`

      await Promise.allSettled([
        sendTelegram(
          `${emoji} <b>${signal.final_verdict} ${signal.pair}</b> [${signal.timeframe}]\n` +
          `${outcome === 'win' ? 'TP достигнут' : 'SL пробит'} — <b>${pnlStr}</b>`
        ),
        createNotification(
          signal.user_id,
          `${emoji} ${signal.final_verdict} ${signal.pair} ${signal.timeframe} — ${outcome === 'win' ? 'TP' : 'SL'} (${pnlStr})`
        ),
      ])

      updated++
    }
  }

  return NextResponse.json({ ok: true, expired, checked: pending.length, updated })
}
