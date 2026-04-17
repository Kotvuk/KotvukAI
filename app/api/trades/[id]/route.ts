export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { updateTrade } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(params.id)
  if (isNaN(id)) return NextResponse.json({ ok: false, error: 'Invalid id' }, { status: 400 })

  const body = await req.json()
  const tp_price = body.tp_price != null ? parseFloat(body.tp_price) : undefined
  const sl_price = body.sl_price != null ? parseFloat(body.sl_price) : undefined

  await updateTrade(id, user.id, { tp_price, sl_price })
  return NextResponse.json({ ok: true })
}
