export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { updateSignalOutcome } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  const { outcome } = await req.json()
  if (!['win', 'loss'].includes(outcome)) return NextResponse.json({ ok: false, error: 'Invalid outcome' }, { status: 400 })
  await updateSignalOutcome(parseInt(params.id), user.id, outcome)
  return NextResponse.json({ ok: true })
}
