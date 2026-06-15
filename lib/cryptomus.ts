import crypto from 'crypto'

export const CRYPTOMUS_API_URL = 'https://api.cryptomus.com/v1'

export const TIER_PRICES: Record<string, string> = {
  starter: '9.90',
  pro:     '29.90',
  elite:   '79.90',
}

function sign(body: object): string {
  const payload = Buffer.from(JSON.stringify(body)).toString('base64')
  return crypto.createHash('md5').update(payload + process.env.CRYPTOMUS_PAYMENT_API_KEY).digest('hex')
}

export async function cryptomusRequest(path: string, body: object) {
  const merchant = process.env.CRYPTOMUS_MERCHANT_ID
  if (!merchant || !process.env.CRYPTOMUS_PAYMENT_API_KEY) {
    throw new Error('Cryptomus credentials not configured')
  }

  const res = await fetch(`${CRYPTOMUS_API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'merchant': merchant,
      'sign': sign(body),
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok || data?.state === 1) {
    throw new Error(`Cryptomus API error: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return data
}

export async function createRecurringSubscription({ userId, tier }: { userId: number; tier: string }) {
  const amount = TIER_PRICES[tier]
  if (!amount) throw new Error('Invalid tier')

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kotvuk.asia'
  const orderId = `cryptomus_${userId}_${tier}_${Date.now()}`

  const data = await cryptomusRequest('/recurrence/create', {
    amount,
    currency: 'USDT',
    name: `KotvukAI ${tier} subscription`,
    period: 'monthly',
    order_id: orderId,
    url_callback: `${siteUrl}/api/billing/webhook`,
    additional_data: JSON.stringify({ userId, tier }),
  })

  return { ...data.result, order_id: orderId }
}

export async function getRecurringSubscriptionInfo(uuid: string) {
  return cryptomusRequest('/recurrence/info', { uuid })
}

export async function cancelRecurringSubscription(uuid: string) {
  return cryptomusRequest('/recurrence/cancel', { uuid })
}

export function verifyCryptomusSignature(body: Record<string, unknown>): boolean {
  const { sign: receivedSign, ...rest } = body
  if (typeof receivedSign !== 'string') return false
  const payload = Buffer.from(JSON.stringify(rest)).toString('base64')
  const calculated = crypto.createHash('md5').update(payload + process.env.CRYPTOMUS_PAYMENT_API_KEY).digest('hex')
  return calculated === receivedSign
}
