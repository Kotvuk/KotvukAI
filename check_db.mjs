import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

const recentSignals = await sql`
  SELECT id, pair, timeframe, final_verdict, created_at
  FROM signals
  WHERE created_at > NOW() - INTERVAL '24 hours'
  ORDER BY created_at DESC
  LIMIT 30
`
console.log('--- SIGNALS last 24h ---')
console.log(JSON.stringify(recentSignals, null, 1))

const recentTrades = await sql`
  SELECT id, pair, direction, status, account_type, created_at, closed_at
  FROM trades
  WHERE created_at > NOW() - INTERVAL '48 hours' OR closed_at > NOW() - INTERVAL '48 hours'
  ORDER BY created_at DESC
  LIMIT 30
`
console.log('--- TRADES last 48h ---')
console.log(JSON.stringify(recentTrades, null, 1))

const recentNotifs = await sql`
  SELECT id, user_id, message, created_at
  FROM notifications
  WHERE created_at > NOW() - INTERVAL '24 hours'
  ORDER BY created_at DESC
  LIMIT 40
`
console.log('--- NOTIFICATIONS last 24h ---')
console.log(JSON.stringify(recentNotifs, null, 1))
