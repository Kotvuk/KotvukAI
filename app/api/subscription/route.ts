export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { getSubscription, SUBSCRIPTION_LIMITS } from '@/lib/db'

const SUBSCRIPTION_PLANS = [
  { tier: 'free',    name: 'Free',    price: 0,     analyses_per_day: SUBSCRIPTION_LIMITS.free },
  { tier: 'starter', name: 'Starter', price: 9,  analyses_per_day: SUBSCRIPTION_LIMITS.starter },
  { tier: 'pro',     name: 'Pro',     price: 29, analyses_per_day: SUBSCRIPTION_LIMITS.pro },
  { tier: 'elite',   name: 'Elite',   price: 79, analyses_per_day: SUBSCRIPTION_LIMITS.elite },
]

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const sub = await getSubscription(user.id)
  const limit = SUBSCRIPTION_LIMITS[sub.tier] ?? 3
  const today = new Date().toISOString().slice(0, 10)
  const analysesToday = sub.last_reset_date === today ? sub.analyses_today : 0

  return NextResponse.json({
    ok: true,
    subscription: sub,
    limit,
    analyses_today: analysesToday,
    remaining: Math.max(0, limit - analysesToday),
    plans: SUBSCRIPTION_PLANS,
  })
}

