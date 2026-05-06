export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { getPendingTrades, activateTrade, cancelTrade, createNotification } from '@/lib/db'
import { sendTelegram } from '@/lib/telegram'

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
  } catch { /* продолжить без цен — только отмена истёкших */ }

  let activated = 0
  let cancelled = 0
  const now = Date.now()

  for (const trade of pending) {
    const sym = trade.pair.replace('/', '')

    if (trade.expires_at && new Date(trade.expires_at).getTime() < now) {
      const wasCancelled = await cancelTrade(trade.id, user.id)
      if (wasCancelled) {
        await createNotification(user.id, `🗑️ Лимитный ордер ${trade.direction.toUpperCase()} ${trade.pair} отменён (истёк срок)`)
        await sendTelegram(`🗑️ Лимитный ордер <b>${trade.direction.toUpperCase()} ${trade.pair}</b> отменён — истёк срок (7 дней)`)
        cancelled++
      }
      continue
    }

    if (!trade.limit_price) continue
    const currentPrice = priceMap[sym]
    if (!currentPrice) continue

    const limitHit = trade.direction === 'long'
      ? currentPrice <= trade.limit_price   // Long: цена упала до нашего лимита
      : currentPrice >= trade.limit_price   // Short: цена выросла до нашего лимита

    if (limitHit) {
      const wasActivated = await activateTrade(trade.id, user.id, trade.limit_price)
      if (wasActivated) {
        const activateMsg = `✅ <b>Лимитный ордер исполнен!</b>\n${trade.direction.toUpperCase()} ${trade.pair} по $${trade.limit_price}`
        await createNotification(user.id, `✅ Лимитный ордер исполнен! ${trade.direction.toUpperCase()} ${trade.pair} по $${trade.limit_price}`)
        await sendTelegram(activateMsg)
        activated++
      }
    }
  }

  return NextResponse.json({ ok: true, activated, cancelled, checked: pending.length })
}
