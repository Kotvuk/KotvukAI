import { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/firebase-admin'
import { getUserByFirebaseUid, upsertUser } from '@/lib/db'

export async function getUser(req: NextRequest) {
  const token = req.cookies.get('fb_token')?.value
  if (!token) return null
  const decoded = await verifyToken(token)
  if (!decoded) return null

  let user = await getUserByFirebaseUid(decoded.uid)
  if (!user) {
    // auth/sync might have failed — auto-create user from token claims
    user = await upsertUser(decoded.uid, decoded.email)
  }
  return user
}
