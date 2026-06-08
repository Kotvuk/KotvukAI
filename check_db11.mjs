import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

const sig = await sql`
  SELECT id, user_id, pair, timeframe, final_verdict, outcome, actual_pnl_pct, final_entry, final_sl, final_tp, created_at, raw_response->'analysis'->>'verdict' as rv
  FROM signals WHERE id > 4843 ORDER BY id DESC LIMIT 10
`
console.log('signals with id > 4843:', JSON.stringify(sig, null, 1))

const cnt = await sql`SELECT count(*) FROM signals`
console.log('total signal count', JSON.stringify(cnt))

const dbName = await sql`SELECT current_database() as db, inet_server_addr() as addr`
console.log('db info', JSON.stringify(dbName))
