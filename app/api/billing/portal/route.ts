export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { lsRequest } from '@/lib/lemonsqueezy'
import { sql } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const dbUser = await getUser(req)
    if (!dbUser) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    // find active LS subscription for user
    const subs = await sql`
      SELECT ls_subscription_id FROM subscriptions
      WHERE user_id = ${dbUser.id} AND tier != 'free'
      LIMIT 1
    `
    const lsSubId = subs[0]?.ls_subscription_id
    if (!lsSubId) {
      return NextResponse.json({ ok: false, error: 'Подписка оформлена вручную — управление недоступно через портал. Напишите в поддержку.' }, { status: 400 })
    }

    const data = await lsRequest(`/subscriptions/${lsSubId}`)
    const portalUrl = data?.data?.attributes?.urls?.customer_portal
    if (!portalUrl) return NextResponse.json({ ok: false, error: 'No portal URL' }, { status: 500 })

    return NextResponse.json({ ok: true, url: portalUrl })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
