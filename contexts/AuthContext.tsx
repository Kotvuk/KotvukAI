'use client'
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { User, onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'

interface AuthCtx {
  user: User | null
  loading: boolean
  logout: () => Promise<void>
  getValidToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthCtx>({ user: null, loading: true, logout: async () => {}, getValidToken: async () => null })

async function setTokenCookie(u: User) {
  const token = await u.getIdToken(true)
  document.cookie = `fb_token=${token}; path=/; max-age=3600; SameSite=Strict`
  return token
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(auth.currentUser)
  const [loading, setLoading] = useState(!auth.currentUser)
  const userRef = useRef<User | null>(auth.currentUser)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      userRef.current = u
      if (u) {
        const token = await setTokenCookie(u)
        fetch('/api/auth/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        }).catch(() => {})
      } else {
        document.cookie = 'fb_token=; path=/; max-age=0'
      }
      setLoading(false)
    })

    const refreshInterval = setInterval(async () => {
      if (userRef.current) await setTokenCookie(userRef.current)
    }, 50 * 60 * 1000)

    return () => { unsub(); clearInterval(refreshInterval) }
  }, [])

  const logout = async () => {
    await signOut(auth)
    document.cookie = 'fb_token=; path=/; max-age=0'
    window.location.href = '/login'
  }

  const getValidToken = async (): Promise<string | null> => {
    if (!userRef.current) return null
    return setTokenCookie(userRef.current)
  }

  return <AuthContext.Provider value={{ user, loading, logout, getValidToken }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
