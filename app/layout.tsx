import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { LangProvider } from '@/contexts/LangContext'

export const metadata: Metadata = {
  title: 'KotvukAI — Crypto Analysis',
  description: 'Автоматический анализ криптовалютных графиков с помощью ИИ',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <AuthProvider>
          <LangProvider>
            {children}
          </LangProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
