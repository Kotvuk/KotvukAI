export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { adjustBalance } from '@/lib/db'

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const { type, amount } = await req.json().catch(() => ({})) as { type?: string; amount?: number }
  if ((type !== 'add' && type !== 'subtract') || !amount || amount <= 0 || amount > 10_000_000) {
    return NextResponse.json({ ok: false, error: 'type(add|subtract) and positive amount required (max 10,000,000)' }, { status: 400 })
  }

  const delta = type === 'add' ? amount : -amount
  const newBalance = await adjustBalance(user.id, delta)
  return NextResponse.json({ ok: true, balance: newBalance })
}
