export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe, PRICE_ID_TO_TIER } from '@/lib/stripe'
import { updateSubscriptionTier } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (e) {
    console.error('Webhook signature error:', e)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionChange(sub, 'activate')
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionChange(sub, 'cancel')
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        console.warn('Payment failed for customer:', invoice.customer)
        break
      }
    }
  } catch (e) {
    console.error('Webhook handler error:', e)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleSubscriptionChange(
  sub: Stripe.Subscription,
  action: 'activate' | 'cancel'
) {
  const userId = sub.metadata?.user_id
  if (!userId) {
    console.warn('Webhook: no user_id in subscription metadata')
    return
  }

  if (action === 'cancel') {
    await updateSubscriptionTier(Number(userId), 'free')
    return
  }

  const priceId = sub.items.data[0]?.price?.id
  const tier = PRICE_ID_TO_TIER[priceId] || 'free'

  const periodEnd = (sub as unknown as Record<string, unknown>).current_period_end
  const expiresAt = typeof periodEnd === 'number'
    ? new Date(periodEnd * 1000)
    : undefined

  await updateSubscriptionTier(Number(userId), tier, expiresAt)
}
