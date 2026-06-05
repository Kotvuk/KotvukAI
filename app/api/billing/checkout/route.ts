export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { lsRequest, LS_VARIANT_IDS } from '@/lib/lemonsqueezy'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kotvuk.asia'

export async function POST(req: NextRequest) {
  try {
    const dbUser = await getUser(req)
    if (!dbUser) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { tier } = await req.json()
    const variantId = LS_VARIANT_IDS[tier]
    if (!variantId) return NextResponse.json({ ok: false, error: 'Invalid tier' }, { status: 400 })

    const storeId = process.env.LS_STORE_ID
    if (!storeId) return NextResponse.json({ ok: false, error: 'Store not configured' }, { status: 500 })

    const data = await lsRequest('/checkouts', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_options: {
              embed: false,
              media: false,
              button_color: '#00d4ff',
            },
            checkout_data: {
              email: dbUser.email || undefined,
              custom: {
                user_id: String(dbUser.id),
                firebase_uid: dbUser.firebase_uid,
                tier,
              },
            },
            product_options: {
              redirect_url: `${SITE_URL}/dashboard?payment=success&tier=${tier}`,
            },
          },
          relationships: {
            store:   { data: { type: 'stores',   id: String(storeId) } },
            variant: { data: { type: 'variants',  id: String(variantId) } },
          },
        },
      }),
    })

    const url = data?.data?.attributes?.url
    if (!url) {
      console.error('[checkout] no url, response:', JSON.stringify(data).slice(0, 300))
      return NextResponse.json({ ok: false, error: 'No checkout URL from Lemon Squeezy' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[checkout]', msg)
    return NextResponse.json({ ok: false, error: msg.slice(0, 200) }, { status: 500 })
  }
}
