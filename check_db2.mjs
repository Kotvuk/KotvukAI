import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

const sigs = await sql`
  SELECT id, user_id, pair, timeframe, final_verdict, status, created_at
  FROM signals
  WHERE pair = 'ETH/USDT' AND timeframe IN ('5m','5м')
  ORDER BY created_at DESC
  LIMIT 10
`
console.log('--- ETH/USDT 5m SIGNALS (any time) ---')
console.log(JSON.stringify(sigs, null, 1))

const trades = await sql`
  SELECT id, user_id, pair, direction, status, account_type, entry_price, sl_price, tp_price, created_at, closed_at, expires_at
  FROM trades
  WHERE pair = 'ETH/USDT'
  ORDER BY created_at DESC
  LIMIT 10
`
console.log('--- ETH/USDT TRADES (any time) ---')
console.log(JSON.stringify(trades, null, 1))
