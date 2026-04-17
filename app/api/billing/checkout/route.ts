export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { setStripeCustomerId } from '@/lib/db'
import { stripe, TIER_PRICE_IDS } from '@/lib/stripe'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kotvuk.asia'

export async function POST(req: NextRequest) {
  try {
    const dbUser = await getUser(req)
    if (!dbUser) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { tier } = await req.json()
    const priceId = TIER_PRICE_IDS[tier]
    if (!priceId) return NextResponse.json({ ok: false, error: 'Invalid tier' }, { status: 400 })

    // Reuse existing Stripe customer or create new
    let customerId = dbUser.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: dbUser.email || undefined,
        metadata: { firebase_uid: dbUser.firebase_uid, user_id: String(dbUser.id) },
      })
      customerId = customer.id
      await setStripeCustomerId(dbUser.id, customerId)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${SITE_URL}/dashboard?payment=success&tier=${tier}`,
      cancel_url:  `${SITE_URL}/dashboard?payment=cancelled`,
      subscription_data: {
        metadata: { firebase_uid: dbUser.firebase_uid, user_id: String(dbUser.id), tier },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    })

    return NextResponse.json({ ok: true, url: session.url })
  } catch (e) {
    console.error('billing/checkout:', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
