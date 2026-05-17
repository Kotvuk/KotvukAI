export const dynamic = 'force-dynamic'
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

  let finalPnl: number | null = pnl ?? null
  let finalPnlPct: number | null = pnl_pct ?? null

  if (finalPnl === null) {
    try {
      const trade = await getTradeById(parseInt(params.id), user.id)
      if (trade && trade.entry_price && trade.status === 'open') {
        const sym = trade.pair.replace('/', '')
        const priceRes = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${sym}`)
        const priceData: { price?: string } = await priceRes.json()
        const currentPrice = parseFloat(priceData.price || '0')
        if (currentPrice) {
          const dir = trade.direction === 'long' ? 1 : -1
          const entry = Number(trade.entry_price)
          const pnlPct = ((currentPrice - entry) / entry) * 100 * dir * trade.leverage
          const pnlAbs = (pnlPct / 100) * Number(trade.amount)
          finalPnlPct = parseFloat(pnlPct.toFixed(2))
          finalPnl = parseFloat(pnlAbs.toFixed(2))
        }
      }
    } catch {}
  }

  const tradeToClose = await getTradeById(parseInt(params.id), user.id)
  const wasClosed = await closeTrade(parseInt(params.id), user.id, finalPnl, finalPnlPct)
  if (wasClosed && tradeToClose && tradeToClose.account_type === 'ai') {
    const restored = Number(tradeToClose.amount) + (finalPnl ?? 0)
    await adjustBalance(user.id, restored)
  }
  return NextResponse.json({ ok: true, pnl: finalPnl, pnl_pct: finalPnlPct })
}
