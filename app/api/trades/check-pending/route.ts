export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { getPendingTrades, activateTrade, cancelTrade, createNotification, adjustBalance } from '@/lib/db'

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const pending = await getPendingTrades(user.id)
  if (!pending.length) return NextResponse.json({ ok: true, activated: 0, cancelled: 0 })

  const pairs = Array.from(new Set(pending.map(t => t.pair.replace('/', ''))))
  const priceMap: Record<string, number> = {}

  try {
    const symbols = JSON.stringify(pairs)
    const res = await fetch(
      `https://fapi.binance.com/fapi/v1/ticker/price?symbols=${encodeURIComponent(symbols)}`
    )
    if (res.ok) {
      const data: { symbol: string; price: string }[] = await res.json()
      for (const d of data) priceMap[d.symbol] = parseFloat(d.price)
    }
  } catch {}

  let activated = 0
  let cancelled = 0
  const now = Date.now()

  for (const trade of pending) {
    const sym = trade.pair.replace('/', '')

    if (trade.expires_at && new Date(trade.expires_at).getTime() < now) {
      const wasCancelled = await cancelTrade(trade.id, user.id)
      if (wasCancelled) {
        if (trade.account_type === 'ai') await adjustBalance(user.id, Number(trade.amount))
        await createNotification(user.id, `🗑️ Limit order ${trade.direction.toUpperCase()} ${trade.pair} cancelled (expired)`)
        cancelled++
      }
      continue
    }

    if (!trade.limit_price) continue
    const currentPrice = priceMap[sym]
    if (!currentPrice) continue

    const limitHit = trade.direction === 'long'
      ? currentPrice <= trade.limit_price
      : currentPrice >= trade.limit_price

    if (limitHit) {
      const wasActivated = await activateTrade(trade.id, user.id, trade.limit_price)
      if (wasActivated) {
        await createNotification(user.id, `✅ Limit order executed! ${trade.direction.toUpperCase()} ${trade.pair} @ $${trade.limit_price}`)
        activated++
      }
    }
  }

  return NextResponse.json({ ok: true, activated, cancelled, checked: pending.length })
}
