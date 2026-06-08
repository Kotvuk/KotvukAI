import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

const latest = await sql`
  SELECT id, message, created_at FROM notifications
  WHERE message LIKE '%ETH/USDT 5%'
  ORDER BY id DESC LIMIT 5
`
console.log('--- latest ETH/USDT 5m notifs ---')
console.log(JSON.stringify(latest, null, 1))

const now = await sql`SELECT NOW() as now`
console.log('--- DB NOW() ---', JSON.stringify(now))

const allRecentMsgs = await sql`
  SELECT id, message, created_at FROM notifications
  ORDER BY id DESC LIMIT 8
`
console.log('--- 8 most recent notifications overall ---')
console.log(JSON.stringify(allRecentMsgs, null, 1))
