export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, VARIANT_ID_TO_TIER } from '@/lib/lemonsqueezy'
import { updateSubscriptionTier, sql } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('x-signature') || ''

  if (!verifyWebhookSignature(body, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: Record<string, unknown>
  try { event = JSON.parse(body) } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const meta      = event.meta as Record<string, unknown> | undefined
  const eventName = String(meta?.event_name || '')
  const customData = meta?.custom_data as Record<string, unknown> | undefined
  const userId    = String(customData?.user_id || '')
  const data      = event.data as Record<string, unknown> | undefined
  const attrs     = data?.attributes as Record<string, unknown> | undefined
  const lsSubId   = String(data?.id || '')

  if (!userId) return NextResponse.json({ received: true })

  try {
    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated': {
        const variantId = String(attrs?.variant_id || '')
        const tier = VARIANT_ID_TO_TIER[variantId] || 'free'
        const renewsAt = attrs?.renews_at ? new Date(String(attrs.renews_at)) : undefined
        const lsCustomerId = String(attrs?.customer_id || '')
        await updateSubscriptionTier(Number(userId), tier, renewsAt)
        if (lsSubId) {
          await sql`UPDATE subscriptions SET ls_subscription_id=${lsSubId}, ls_customer_id=${lsCustomerId} WHERE user_id=${Number(userId)}`
        }
        break
      }
      case 'subscription_cancelled': {
        await updateSubscriptionTier(Number(userId), 'free')
        break
      }
      case 'order_created': {
        const firstItem = (attrs?.first_order_item as Record<string, unknown>) || {}
        const variantId = String(firstItem?.variant_id || '')
        if (variantId) {
          const tier = VARIANT_ID_TO_TIER[variantId] || 'free'
          if (tier !== 'free') await updateSubscriptionTier(Number(userId), tier)
        }
        break
      }
    }
  } catch (e) {
    console.error('[ls-webhook]', e)
  }

  return NextResponse.json({ received: true })
}
