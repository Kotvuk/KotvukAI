export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { getTrades, createTrade, adjustBalance } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const accountType = req.nextUrl.searchParams.get('account') as 'user' | 'ai' | null
  const limit  = Math.min(500, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit')  || '200')))
  const offset = Math.max(0, parseInt(req.nextUrl.searchParams.get('offset') || '0'))
  const trades = await getTrades(user.id, accountType ?? undefined, limit, offset)
  return NextResponse.json({ ok: true, trades })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const amount = Number(body.amount)
  if (!body.pair || !body.direction || !amount || amount <= 0) {
    return NextResponse.json({ ok: false, error: 'pair, direction, amount required' }, { status: 400 })
  }
  body.amount = amount

  if (body.order_type === 'market' && !body.entry_price) {
    try {
      const sym = body.pair.replace('/', '')
      const res = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${sym}`, { signal: AbortSignal.timeout(6_000) })
      const d: { price?: string } = await res.json()
      if (d.price) body.entry_price = parseFloat(d.price)
    } catch {}
  }
  const trade = await createTrade(user.id, { ...body, account_type: body.account_type ?? 'user' })
  if ((body.account_type ?? 'user') === 'ai') {
    await adjustBalance(user.id, -(Number(body.amount) || 0))
  }
  return NextResponse.json({ ok: true, trade })
}
