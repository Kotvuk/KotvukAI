export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { updateUserSettings } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    ok: true,
    settings: {
      nickname: user.nickname,
      email: user.email,
      lang: user.lang,
      ai_max_leverage: Number(user.ai_max_leverage ?? 20),
      ai_balance: Number(user.ai_balance ?? 1000),
      ai_risk_per_trade: Number(user.ai_risk_per_trade ?? 1.0),
    },
  })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const { nickname, email, lang, ai_max_leverage, ai_balance, ai_risk_per_trade } = await req.json()

  const leverage  = ai_max_leverage  != null ? Math.max(1,  Math.min(125,     Number(ai_max_leverage)))  : undefined
  const balance   = ai_balance       != null ? Math.max(10, Math.min(10_000_000, Number(ai_balance)))     : undefined
  const riskPct   = ai_risk_per_trade != null ? Math.max(0.1, Math.min(10, Number(ai_risk_per_trade)))   : undefined

  await updateUserSettings(user.id, { nickname, email, lang, ai_max_leverage: leverage, ai_balance: balance, ai_risk_per_trade: riskPct })
  return NextResponse.json({ ok: true })
}
