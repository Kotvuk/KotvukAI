import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

const r1 = await sql`
  SELECT id, pair, timeframe, final_verdict, outcome, created_at, length(timeframe) as tflen, length(pair) as pairlen
  FROM signals
  WHERE pair ILIKE '%ETH%' OR timeframe ILIKE '%5%'
  ORDER BY id DESC LIMIT 25
`
console.log(JSON.stringify(r1, null, 1))
