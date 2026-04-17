import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
})

export const TIER_PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || '',
  pro:     process.env.STRIPE_PRICE_PRO     || '',
  elite:   process.env.STRIPE_PRICE_ELITE   || '',
}

export const PRICE_ID_TO_TIER: Record<string, string> = Object.fromEntries(
  Object.entries(TIER_PRICE_IDS).map(([tier, priceId]) => [priceId, tier])
)
