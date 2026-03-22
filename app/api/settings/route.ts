export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { updateUserSettings } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ ok: true, settings: { nickname: user.nickname, email: user.email, lang: user.lang } })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const { nickname, email, lang } = await req.json()
  await updateUserSettings(user.id, { nickname, email, lang })
  return NextResponse.json({ ok: true })
}
