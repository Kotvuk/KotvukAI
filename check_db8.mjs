import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

const recent = await sql`
  SELECT id, user_id, pair, timeframe, final_verdict, outcome, actual_pnl_pct, created_at
  FROM signals
  ORDER BY id DESC LIMIT 20
`
console.log('--- 20 most recent signals by id ---')
console.log(JSON.stringify(recent, null, 1))

const maxId = await sql`SELECT MAX(id) as max FROM signals`
console.log('max signal id', JSON.stringify(maxId))
