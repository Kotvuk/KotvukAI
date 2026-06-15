export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { cancelRecurringSubscription } from '@/lib/cryptomus'
import { sql } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const dbUser = await getUser(req)
    if (!dbUser) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const subs = await sql`
      SELECT cryptomus_subscription_id FROM subscriptions
      WHERE user_id = ${dbUser.id} AND tier != 'free'
      LIMIT 1
    `
    const subUuid = subs[0]?.cryptomus_subscription_id
    if (!subUuid) {
      return NextResponse.json({ ok: false, error: 'Активная подписка не найдена. Напишите в поддержку.' }, { status: 400 })
    }

    await cancelRecurringSubscription(subUuid)
    await sql`UPDATE subscriptions SET cryptomus_subscription_id=NULL WHERE user_id=${dbUser.id}`

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[billing-portal]', msg)
    return NextResponse.json({ ok: false, error: 'Не удалось отменить подписку. Попробуйте позже.' }, { status: 500 })
  }
}
