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
            store: { data: { type: 'stores', id: storeId } },
            variant: { data: { type: 'variants', id: variantId } },
          },
        },
      }),
    })

    const url = data?.data?.attributes?.url
    if (!url) return NextResponse.json({ ok: false, error: 'No checkout URL' }, { status: 500 })

    return NextResponse.json({ ok: true, url })
  } catch (e) {
    console.error('[checkout]', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
