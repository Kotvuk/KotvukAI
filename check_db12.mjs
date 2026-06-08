import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

const r = await sql`
  SELECT id, pair, timeframe, final_verdict, outcome,
    encode(pair::bytea, 'hex') as pair_hex,
    encode(timeframe::bytea, 'hex') as tf_hex
  FROM signals
  WHERE outcome IS NULL OR (final_verdict='LONG' AND pair ~ 'ETH')
  ORDER BY id DESC LIMIT 15
`
console.log(JSON.stringify(r, null, 1))
