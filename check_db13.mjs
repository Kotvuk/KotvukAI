import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

const pt = await sql`SELECT * FROM trades WHERE status = 'pending' ORDER BY id DESC LIMIT 10`
console.log('--- pending trades ---')
console.log(JSON.stringify(pt, null, 1))
