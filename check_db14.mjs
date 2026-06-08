import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL)

const schemas = await sql`
  SELECT table_schema, table_name FROM information_schema.tables
  WHERE table_name IN ('signals','trades') ORDER BY table_schema
`
console.log('--- tables across schemas ---')
console.log(JSON.stringify(schemas, null, 1))

const sp = await sql`SHOW search_path`
console.log('search_path', JSON.stringify(sp))
