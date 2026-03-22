export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { getSignals } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100')
  const signals = await getSignals(user.id, limit)
  return NextResponse.json({ ok: true, signals })
}
