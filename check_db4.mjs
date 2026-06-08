import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

const sigs = await sql`
  SELECT id, user_id, pair, timeframe, final_verdict, final_entry, final_sl, final_tp, status, created_at
  FROM signals
  WHERE pair ILIKE '%ETH%' AND final_verdict = 'LONG'
  ORDER BY created_at DESC
  LIMIT 15
`
console.log('--- ETH LONG signals ---')
console.log(JSON.stringify(sigs, null, 1))

const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='signals'`
console.log('--- signals columns ---', cols.map(c=>c.column_name).join(', '))

const pendingCount = await sql`
  SELECT pair, timeframe, final_verdict, status, count(*) FROM signals
  WHERE status = 'pending' OR status IS NULL
  GROUP BY pair, timeframe, final_verdict, status
  ORDER BY count(*) DESC LIMIT 20
`
console.log('--- pending signals grouped ---')
console.log(JSON.stringify(pendingCount, null, 1))
