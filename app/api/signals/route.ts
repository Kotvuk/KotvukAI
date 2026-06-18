export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { getSignals, clearSignals } from '@/lib/db'
import type { Market } from '@/lib/markets'

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const limit  = Math.min(1000, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit')  || '100')))
  const offset = Math.max(0, parseInt(req.nextUrl.searchParams.get('offset') || '0'))
  const market = (req.nextUrl.searchParams.get('market') as Market) || 'crypto'
  const tradableOnly = req.nextUrl.searchParams.get('tradable') === '1'
  const signals = await getSignals(user.id, limit, offset, market, tradableOnly)
  return NextResponse.json({ ok: true, signals })
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  await clearSignals(user.id)
  return NextResponse.json({ ok: true })
}
