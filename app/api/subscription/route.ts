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
    features: ['3 Р°РЅР°Р»РёР·Р° РІ РґРµРЅСЊ', 'РСЃС‚РѕСЂРёСЏ СЃРёРіРЅР°Р»РѕРІ', 'РўРѕСЂРіРѕРІС‹Р№ Р¶СѓСЂРЅР°Р»'],
  },
  {
    tier: 'starter',
    name: 'Starter',
    price: 9.99,
    analyses_per_day: SUBSCRIPTION_LIMITS.starter,
    features: ['10 Р°РЅР°Р»РёР·РѕРІ РІ РґРµРЅСЊ', 'Р’СЃРµ С„РёС‡Рё Free', 'Р›РёРјРёС‚РЅС‹Рµ РѕСЂРґРµСЂР°', 'РЈРІРµРґРѕРјР»РµРЅРёСЏ'],
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: 19.99,
    analyses_per_day: SUBSCRIPTION_LIMITS.pro,
    features: ['30 Р°РЅР°Р»РёР·РѕРІ РІ РґРµРЅСЊ', 'Р’СЃРµ С„РёС‡Рё Starter', 'AI Р§Р°С‚', 'Р Р°СЃС€РёСЂРµРЅРЅР°СЏ РёСЃС‚РѕСЂРёСЏ'],
  },
  {
    tier: 'elite',
    name: 'Elite',
    price: 49.99,
    analyses_per_day: SUBSCRIPTION_LIMITS.elite,
    features: ['100 Р°РЅР°Р»РёР·РѕРІ РІ РґРµРЅСЊ', 'Р’СЃРµ С„РёС‡Рё Pro', 'РџСЂРёРѕСЂРёС‚РµС‚РЅР°СЏ РїРѕРґРґРµСЂР¶РєР°', 'API РґРѕСЃС‚СѓРї'],
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
