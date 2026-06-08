import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

const notif = await sql`SELECT id, message, created_at FROM notifications ORDER BY id DESC LIMIT 3`
console.log('latest notif', JSON.stringify(notif, null, 1))

const sig = await sql`
  SELECT id, user_id, pair, timeframe, final_verdict, outcome, actual_pnl_pct, final_entry, final_sl, final_tp, created_at
  FROM signals WHERE id = (SELECT MAX(id) FROM signals WHERE pair ILIKE '%ETH%')
`
console.log('latest eth signal', JSON.stringify(sig, null, 1))

const allPending = await sql`
  SELECT id, user_id, pair, timeframe, final_verdict, outcome, final_entry, final_sl, final_tp, created_at
  FROM signals WHERE outcome IS NULL AND final_verdict IN ('LONG','SHORT') AND final_tp IS NOT NULL AND final_sl IS NOT NULL
  ORDER BY created_at ASC LIMIT 10
`
console.log('all pending matching getAllPendingSignals filter', JSON.stringify(allPending, null, 1))
