export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { closeTrade, cancelTrade, getTradeById, adjustBalance } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { pnl, pnl_pct, cancel } = body as { pnl?: number; pnl_pct?: number; cancel?: boolean }

  if (cancel) {
    const tradeToCancel = await getTradeById(parseInt(params.id), user.id)
    const wasCancelled = await cancelTrade(parseInt(params.id), user.id)
    if (wasCancelled && tradeToCancel && tradeToCancel.account_type === 'ai') {
      await adjustBalance(user.id, Number(tradeToCancel.amount))
    }
    return NextResponse.json({ ok: true })
  }

  const tradeToClose = await getTradeById(parseInt(params.id), user.id)
  if (!tradeToClose) return NextResponse.json({ ok: false, error: 'Trade not found' }, { status: 404 })

  let finalPnl: number | null = tradeToClose.account_type === 'user' ? (pnl ?? null) : null
  let finalPnlPct: number | null = tradeToClose.account_type === 'user' ? (pnl_pct ?? null) : null
  let exitPrice: number | null = null

  if (finalPnl === null && tradeToClose.entry_price && tradeToClose.status === 'open') {
    try {
      const sym = tradeToClose.pair.replace('/', '')
      const priceRes = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${sym}`, { signal: AbortSignal.timeout(6_000) })
      const priceData: { price?: string } = await priceRes.json()
      const currentPrice = parseFloat(priceData.price || '0')
      if (!currentPrice) {
        return NextResponse.json({ ok: false, error: 'Не удалось получить текущую цену, попробуйте позже' }, { status: 503 })
      }
      exitPrice = currentPrice
      const dir = tradeToClose.direction === 'long' ? 1 : -1
      const entry = Number(tradeToClose.entry_price)
      const pnlPct = ((currentPrice - entry) / entry) * 100 * dir * tradeToClose.leverage
      const pnlAbs = (pnlPct / 100) * Number(tradeToClose.amount)
      finalPnlPct = parseFloat(pnlPct.toFixed(2))
      finalPnl = parseFloat(pnlAbs.toFixed(2))
    } catch {
      return NextResponse.json({ ok: false, error: 'Не удалось получить текущую цену, попробуйте позже' }, { status: 503 })
    }
  }

  const wasClosed = await closeTrade(parseInt(params.id), user.id, finalPnl, finalPnlPct, exitPrice)
  if (wasClosed && tradeToClose.account_type === 'ai') {
    const restored = Math.max(0, Number(tradeToClose.amount) + (finalPnl ?? 0))
    await adjustBalance(user.id, restored)
  }
  return NextResponse.json({ ok: true, pnl: finalPnl, pnl_pct: finalPnlPct })
}
