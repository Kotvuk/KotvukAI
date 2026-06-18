export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { sql, updateSubscriptionTier } from '@/lib/db'
import { getUser as getAuthUser } from '@/lib/auth-helper'
import { verifyPayment } from '@/lib/payment-verifier'
import { NETWORK_LABELS } from '@/lib/payment'

async function sendAdminTg(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.ADMIN_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  }).catch(() => {})
}

export async function POST(req: NextRequest) {
  try {
    const dbUser = await getAuthUser(req)
    if (!dbUser) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { paymentId, txHash } = await req.json()
    if (!paymentId || !txHash?.trim()) return NextResponse.json({ ok: false, error: 'Missing paymentId or txHash' }, { status: 400 })

    const rows = await sql`
      SELECT * FROM payments
      WHERE id = ${paymentId} AND user_id = ${dbUser.id}
      LIMIT 1
    `
    if (!rows.length) return NextResponse.json({ ok: false, error: 'Payment not found' }, { status: 404 })

    const payment = rows[0] as {
      id: number; user_id: number; tier: string; amount_usd: string;
      network: string; status: string; expires_at: string; tx_hash: string | null
    }

    if (payment.status !== 'pending') return NextResponse.json({ ok: false, error: 'Payment already processed' }, { status: 400 })
    if (new Date(payment.expires_at) < new Date()) return NextResponse.json({ ok: false, error: 'Payment expired' }, { status: 400 })

    const existing = await sql`SELECT id FROM payments WHERE tx_hash = ${txHash} LIMIT 1`
    if (existing.length) return NextResponse.json({ ok: false, error: 'TX hash already used' }, { status: 400 })

    const result = await verifyPayment(payment.network, txHash, parseFloat(payment.amount_usd))
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error || 'Verification failed' }, { status: 400 })

    await sql`
      UPDATE payments
      SET status = 'confirmed', tx_hash = ${txHash}, verified_at = NOW()
      WHERE id = ${paymentId}
    `

    const eliteExpiry = payment.tier === 'elite' ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : undefined
    await updateSubscriptionTier(dbUser.id, payment.tier, eliteExpiry)

    const networkLabel = NETWORK_LABELS[payment.network] || payment.network.toUpperCase()
    const shortTx = txHash.length > 20 ? txHash.slice(0, 10) + '...' + txHash.slice(-6) : txHash
    await sendAdminTg(
      `💰 Новая оплата!\nТариф: ${payment.tier.charAt(0).toUpperCase() + payment.tier.slice(1)} ($${payment.amount_usd})\nСеть: ${networkLabel}\nTX: ${shortTx}\nПользователь: ${dbUser.email || `id=${dbUser.id}`}`
    )

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg.slice(0, 200) }, { status: 500 })
  }
}
