import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

const sigs = await sql`
  SELECT id, user_id, pair, timeframe, final_verdict, outcome, actual_pnl_pct, final_entry, final_sl, final_tp, created_at
  FROM signals
  WHERE pair ILIKE '%ETH%'
  ORDER BY created_at DESC
  LIMIT 20
`
console.log('--- ALL ETH signals (any tf, any outcome) ---')
console.log(JSON.stringify(sigs, null, 1))

const notifCount = await sql`
  SELECT count(*) FROM notifications WHERE message LIKE '%ETH/USDT 5%SL%'
`
console.log('--- total ETH/USDT 5m SL notif count ---', JSON.stringify(notifCount))
