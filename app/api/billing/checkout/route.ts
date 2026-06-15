export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { createRecurringSubscription, TIER_PRICES } from '@/lib/cryptomus'
import { sql } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const dbUser = await getUser(req)
    if (!dbUser) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { tier } = await req.json()
    if (!TIER_PRICES[tier]) return NextResponse.json({ ok: false, error: 'Invalid tier' }, { status: 400 })

    const subscription = await createRecurringSubscription({ userId: dbUser.id, tier })

    await sql`
      INSERT INTO subscriptions (user_id, tier, analyses_today, last_reset_date, cryptomus_subscription_id, cryptomus_order_id)
      VALUES (${dbUser.id}, 'free', 0, CURRENT_DATE, ${subscription.uuid}, ${subscription.order_id})
      ON CONFLICT (user_id) DO UPDATE SET
        cryptomus_subscription_id = EXCLUDED.cryptomus_subscription_id,
        cryptomus_order_id = EXCLUDED.cryptomus_order_id
    `

    return NextResponse.json({ ok: true, url: subscription.url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[checkout]', msg)
    return NextResponse.json({ ok: false, error: msg.slice(0, 200) }, { status: 500 })
  }
}
