export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCryptomusSignature } from '@/lib/cryptomus'
import { updateSubscriptionTier, sql } from '@/lib/db'

const PAID_STATUSES = ['paid', 'paid_over']
const FAILED_STATUSES = ['fail', 'cancel', 'system_fail', 'wrong_amount']
const REFUND_STATUSES = ['refund_process', 'refund_fail', 'refund_paid']

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  if (!verifyCryptomusSignature(body)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const orderId = String(body.order_id || '')
  const uuid    = String(body.uuid || '')
  const status  = String(body.status || '')

  if (!orderId && !uuid) return NextResponse.json({ received: true })

  try {
    const rows = await sql`
      SELECT user_id, tier FROM subscriptions
      WHERE cryptomus_order_id = ${orderId} OR cryptomus_subscription_id = ${uuid}
      LIMIT 1
    `
    const sub = rows[0]
    if (!sub) return NextResponse.json({ received: true })

    const userId = Number(sub.user_id)
    let additionalData: Record<string, unknown> = {}
    try { additionalData = JSON.parse(String(body.additional_data || '{}')) } catch {}
    const tier = String(additionalData.tier || sub.tier || 'free')

    if (PAID_STATUSES.includes(status)) {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      await updateSubscriptionTier(userId, tier, expiresAt)
      await sql`UPDATE subscriptions SET cryptomus_subscription_id=${uuid}, cryptomus_order_id=${orderId} WHERE user_id=${userId}`
    } else if (REFUND_STATUSES.includes(status) || status === 'cancel') {
      await updateSubscriptionTier(userId, 'free')
    } else if (FAILED_STATUSES.includes(status)) {
      console.error('[cryptomus-webhook] payment failed', { userId, status })
    }
  } catch (e) {
    console.error('[cryptomus-webhook]', e)
  }

  return NextResponse.json({ received: true })
}
