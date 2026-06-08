import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)
const r = await sql`SELECT id, pair, timeframe, final_verdict, outcome, created_at FROM signals WHERE id = 554`
console.log('id=554 via .env.local connection:', JSON.stringify(r))
const r2 = await sql`SELECT inet_server_addr() as addr, current_database() as db`
console.log('conn info:', JSON.stringify(r2))
