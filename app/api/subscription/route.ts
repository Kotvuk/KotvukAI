export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { getSubscription, updateSubscriptionTier, SUBSCRIPTION_LIMITS } from '@/lib/db'

const SUBSCRIPTION_PLANS = [
  {
    tier: 'free',
    name: 'Free',
    price: 0,
    analyses_per_day: SUBSCRIPTION_LIMITS.free,
    features: ['3 анализа в день', 'История сигналов', 'Торговый журнал'],
  },
  {
    tier: 'starter',
    name: 'Starter',
    price: 9.99,
    analyses_per_day: SUBSCRIPTION_LIMITS.starter,
    features: ['10 анализов в день', 'Все фичи Free', 'Лимитные ордера', 'Уведомления'],
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: 19.99,
    analyses_per_day: SUBSCRIPTION_LIMITS.pro,
    features: ['30 анализов в день', 'Все фичи Starter', 'AI Чат', 'Расширенная история'],
  },
  {
    tier: 'elite',
    name: 'Elite',
    price: 49.99,
    analyses_per_day: SUBSCRIPTION_LIMITS.elite,
    features: ['100 анализов в день', 'Все фичи Pro', 'Приоритетная поддержка', 'API доступ'],
  },
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

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const { tier, expires_at } = await req.json()
  if (!['free', 'starter', 'pro', 'elite'].includes(tier)) {
    return NextResponse.json({ ok: false, error: 'Invalid tier' }, { status: 400 })
  }

  await updateSubscriptionTier(user.id, tier, expires_at ? new Date(expires_at) : undefined)
  return NextResponse.json({ ok: true, tier })
}
