import { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/firebase-admin'
import { getUserByFirebaseUid } from '@/lib/db'

export async function getUser(req: NextRequest) {
  const token = req.cookies.get('fb_token')?.value
  if (!token) return null
  const uid = await verifyToken(token)
  if (!uid) return null
  return getUserByFirebaseUid(uid)
}
