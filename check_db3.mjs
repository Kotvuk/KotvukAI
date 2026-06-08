import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

const sigs = await sql`
  SELECT id, user_id, pair, timeframe, final_verdict, final_entry, final_sl, final_tp, created_at
  FROM signals
  WHERE pair = 'ETH/USDT' AND timeframe IN ('5m','5м')
  ORDER BY created_at DESC
  LIMIT 10
`
console.log('--- ETH/USDT 5m SIGNALS ---')
console.log(JSON.stringify(sigs, null, 1))

const cols = await sql`
  SELECT column_name FROM information_schema.columns WHERE table_name = 'trades'
`
console.log('--- TRADES COLUMNS ---')
console.log(cols.map(c=>c.column_name).join(', '))

const trades = await sql`
  SELECT * FROM trades WHERE pair = 'ETH/USDT' ORDER BY id DESC LIMIT 10
`
console.log('--- ETH/USDT TRADES ---')
console.log(JSON.stringify(trades, null, 1))
