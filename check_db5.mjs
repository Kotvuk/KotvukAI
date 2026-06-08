import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

const sigs = await sql`
  SELECT id, user_id, pair, timeframe, final_verdict, outcome, final_entry, final_sl, final_tp, created_at
  FROM signals
  WHERE outcome IS NULL
  ORDER BY created_at DESC
  LIMIT 30
`
console.log('--- pending (outcome IS NULL) signals ---')
console.log(JSON.stringify(sigs, null, 1))
