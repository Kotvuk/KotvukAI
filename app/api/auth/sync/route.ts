export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/firebase-admin'
import { upsertUser, initDB } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    await initDB()
    const { token } = await req.json()
    if (!token) return NextResponse.json({ ok: false, error: 'No token' }, { status: 400 })

    const decoded = await verifyToken(token)
    if (!decoded) return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 })

    const user = await upsertUser(decoded.uid, decoded.email)

    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, nickname: user.nickname, lang: user.lang } })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
