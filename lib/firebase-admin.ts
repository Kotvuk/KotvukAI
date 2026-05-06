import type { Auth } from 'firebase-admin/auth'

let _adminAuth: Auth | null = null

function getAdminAuth(): Auth {
  if (_adminAuth) return _adminAuth

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initializeApp, getApps, cert } = require('firebase-admin/app')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getAuth } = require('firebase-admin/auth')

  const app = getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      })
  _adminAuth = getAuth(app) as Auth
  return _adminAuth
}

export const adminAuth = { getUser: (uid: string) => getAdminAuth().getUser(uid) }

export async function verifyToken(token: string): Promise<{ uid: string; email: string } | null> {
  try {
    const decoded = await getAdminAuth().verifyIdToken(token)
    return { uid: decoded.uid, email: decoded.email || '' }
  } catch {
    return null
  }
}
