export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { getLevelAlerts, createLevelAlert } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const alerts = await getLevelAlerts(user.id)
  return NextResponse.json({ ok: true, alerts })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { pair, zone_type, price_high, price_low, label } = body
  if (!pair || !zone_type || !price_high || !price_low) {
    return NextResponse.json({ ok: false, error: 'Missing fields' }, { status: 400 })
  }
  const alert = await createLevelAlert(user.id, {
    pair, zone_type,
    price_high: Number(price_high),
    price_low: Number(price_low),
    label: label || undefined,
  })
  return NextResponse.json({ ok: true, alert })
}
