export const LS_API_URL = 'https://api.lemonsqueezy.com/v1'

export const LS_VARIANT_IDS: Record<string, string> = {
  starter: process.env.LS_VARIANT_STARTER || '1118265',
  pro:     process.env.LS_VARIANT_PRO     || '1118278',
  elite:   process.env.LS_VARIANT_ELITE   || '1118284',
}

export const VARIANT_ID_TO_TIER: Record<string, string> = Object.fromEntries(
  Object.entries(LS_VARIANT_IDS).map(([tier, id]) => [id, tier])
)

export async function lsRequest(path: string, options: RequestInit = {}) {
  const res = await fetch(`${LS_API_URL}${path}`, {
    ...options,
    headers: {
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      'Authorization': `Bearer ${process.env.LS_API_KEY}`,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`LS API error ${res.status}: ${err.slice(0, 200)}`)
  }
  return res.json()
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const crypto = require('crypto')
  const secret = process.env.LS_WEBHOOK_SECRET || ''
  const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return hmac === signature
}
