export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { markNotificationsRead } from '@/lib/db'

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  await markNotificationsRead(user.id)
  return NextResponse.json({ ok: true })
}
