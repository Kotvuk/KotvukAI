export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { sql } from '@/lib/db'
import { WALLET_ADDRESSES, TIER_PRICES } from '@/lib/payment'

export async function POST(req: NextRequest) {
  try {
    const dbUser = await getUser(req)
    if (!dbUser) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { tier, network } = await req.json()
    if (!TIER_PRICES[tier]) return NextResponse.json({ ok: false, error: 'Invalid tier' }, { status: 400 })
    if (!WALLET_ADDRESSES[network]) return NextResponse.json({ ok: false, error: 'Invalid network' }, { status: 400 })

    const rows = await sql`
      INSERT INTO payments (user_id, tier, amount_usd, network, wallet_address, status, expires_at)
      VALUES (
        ${dbUser.id},
        ${tier},
        ${TIER_PRICES[tier]},
        ${network},
        ${WALLET_ADDRESSES[network]},
        'pending',
        NOW() + INTERVAL '24 hours'
      )
      RETURNING id
    `

    return NextResponse.json({
      ok: true,
      paymentId: rows[0].id,
      address: WALLET_ADDRESSES[network],
      amount: TIER_PRICES[tier],
      network,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg.slice(0, 200) }, { status: 500 })
  }
}
