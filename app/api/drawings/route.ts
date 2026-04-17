export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { getDrawings, saveDrawings } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const pair = searchParams.get('pair')
  const timeframe = searchParams.get('timeframe')
  if (!pair || !timeframe) return NextResponse.json({ ok: false, error: 'pair and timeframe required' }, { status: 400 })

  const drawings = await getDrawings(user.id, pair, timeframe)
  return NextResponse.json({ ok: true, drawings })
}

export async function PUT(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const { pair, timeframe, drawings } = await req.json()
  if (!pair || !timeframe || !Array.isArray(drawings)) {
    return NextResponse.json({ ok: false, error: 'pair, timeframe and drawings[] required' }, { status: 400 })
  }

  await saveDrawings(user.id, pair, timeframe, drawings)
  return NextResponse.json({ ok: true })
}
