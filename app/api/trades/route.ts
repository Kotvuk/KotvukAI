export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { getTrades, createTrade } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const trades = await getTrades(user.id)
  return NextResponse.json({ ok: true, trades })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.pair || !body.direction || !body.amount) {
    return NextResponse.json({ ok: false, error: 'pair, direction, amount required' }, { status: 400 })
  }
  // Auto-fetch entry price for market orders
  if (body.order_type === 'market' && !body.entry_price) {
    try {
      const sym = body.pair.replace('/', '')
      const res = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${sym}`)
      const d: { price?: string } = await res.json()
      if (d.price) body.entry_price = parseFloat(d.price)
    } catch {}
  }
  const trade = await createTrade(user.id, body)
  return NextResponse.json({ ok: true, trade })
}
