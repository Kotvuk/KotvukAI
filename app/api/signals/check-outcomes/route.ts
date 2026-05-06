export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getPendingSignals, setSignalOutcome, createNotification } from '@/lib/db'
import { getUser } from '@/lib/auth-helper'
import { sendTelegram } from '@/lib/telegram'

const TF_MAP: Record<string, string> = {
  '1Рј': '1m', '5Рј': '5m', '15Рј': '15m', '30Рј': '30m',
  '1С‡': '1h', '4С‡': '4h', '1Рґ': '1d',
}

async function fetchCandlesSince(sym: string, interval: string, sinceMs: number): Promise<{ high: number; low: number; close: number }[]> {
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${interval}&startTime=${sinceMs}&limit=200`
  const res = await fetch(url)
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
      const price    = hitTp ? tp : sl
      const priceDiff = isLong ? price - entry : entry - price
      const pnlPct   = parseFloat(((priceDiff / entry) * leverage * 100).toFixed(2))

      await setSignalOutcome(signal.id, outcome, pnlPct, user.id)

      const emoji  = outcome === 'win' ? 'рџЋ‰вњ…' : 'вќЊ'
      const pnlStr = pnlPct > 0 ? `+${pnlPct}%` : `${pnlPct}%`
      const msg = `${emoji} <b>${signal.final_verdict} ${signal.pair}</b> [${signal.timeframe}]\n` +
        `${outcome === 'win' ? 'TP РґРѕСЃС‚РёРіРЅСѓС‚' : 'SL РїСЂРѕР±РёС‚'} вЂ” <b>${pnlStr}</b>`
      await createNotification(user.id, `${emoji} ${signal.final_verdict} ${signal.pair} ${signal.timeframe} вЂ” ${outcome === 'win' ? 'TP РґРѕСЃС‚РёРіРЅСѓС‚' : 'SL РїСЂРѕР±РёС‚'} (${pnlStr})`)
      await sendTelegram(msg)

      results.push({ id: signal.id, outcome, pnlPct })
    } catch {
    }
  }

  return NextResponse.json({ ok: true, checked: pendingSignals.length, updated: results.length, results })
}
