export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { updateUserSettings, updateUserTelegramChatId } from '@/lib/db'

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
      ai_balance: Number(user.ai_balance ?? 10000),
      ai_trade_amount: Number(user.ai_trade_amount ?? 100),
      telegram_chat_id: user.telegram_chat_id ?? null,
    },
  })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const { nickname, email, lang, ai_max_leverage, ai_balance, ai_trade_amount, telegram_chat_id } = await req.json()

  const leverage    = ai_max_leverage != null ? Math.max(1,   Math.min(125,       Number(ai_max_leverage))) : undefined
  const balance     = ai_balance      != null ? Math.max(10,  Math.min(10_000_000, Number(ai_balance)))     : undefined
  const tradeAmount = ai_trade_amount != null ? Math.max(1,   Math.min(1_000_000,  Number(ai_trade_amount))) : undefined

  await updateUserSettings(user.id, { nickname, email, lang, ai_max_leverage: leverage, ai_balance: balance, ai_trade_amount: tradeAmount })

  if (telegram_chat_id !== undefined) {
    const raw = String(telegram_chat_id || '').trim()
    const chatId = /^-?\d+$/.test(raw) ? raw : raw.replace(/\D/g, '')
    await updateUserTelegramChatId(user.id, chatId)
  }

  return NextResponse.json({ ok: true })
}
