export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { getAllUsersWithSubscriptions, getAdminStats, updateSubscriptionTier, deleteUserById } from '@/lib/db'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'kotvukai@gmail.com')
  .split(',').map(e => e.trim().toLowerCase())

async function requireAdmin(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return null
  if (!ADMIN_EMAILS.includes((user.email || '').toLowerCase())) return null
  return user
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  const [users, stats] = await Promise.all([
    getAllUsersWithSubscriptions(),
    getAdminStats(),
  ])
  return NextResponse.json({ ok: true, users, stats })
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  const { user_id, tier, expires_at } = await req.json()
  if (!user_id || !['free', 'starter', 'pro', 'elite'].includes(tier)) {
    return NextResponse.json({ ok: false, error: 'Invalid params' }, { status: 400 })
  }

  await updateSubscriptionTier(Number(user_id), tier, expires_at ? new Date(expires_at) : undefined)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  const { user_id } = await req.json()
  if (!user_id) return NextResponse.json({ ok: false, error: 'Missing user_id' }, { status: 400 })

  // Safety: cannot delete self
  const targetId = Number(user_id)
  await deleteUserById(targetId)
  return NextResponse.json({ ok: true })
}
