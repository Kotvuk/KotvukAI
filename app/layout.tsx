import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { LangProvider } from '@/contexts/LangContext'

const SITE_URL = 'https://kotvukai.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'KotvukAI — AI-анализ криптовалют | Сигналы LONG/SHORT бесплатно',
    template: '%s | KotvukAI',
  },
  description: 'AI-аналитик криптовалют. Автоматические сигналы LONG/SHORT, SMC Order Blocks, Fair Value Gaps, OTE-входы, 4-шаговый анализ. Groq moonshotai/kimi-k2.',
  keywords: ['AI анализ криптовалют', 'крипто сигналы', 'Smart Money Concepts', 'Order Blocks', 'Fair Value Gap', 'Bitcoin анализ', 'KotvukAI', 'crypto AI', 'SMC trading'],
  authors: [{ name: 'KotvukAI' }],
  creator: 'KotvukAI',
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    alternateLocale: ['en_US', 'kk_KZ'],
    url: SITE_URL,
    siteName: 'KotvukAI',
    title: 'KotvukAI — AI-анализ криптовалют | Сигналы LONG/SHORT',
    description: 'Бесплатный AI-аналитик криптовалют. SMC Order Blocks, FVG, сигналы LONG/SHORT, торговый журнал. Groq AI, мультитаймфреймный анализ.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KotvukAI — AI-анализ криптовалют',
    description: 'Бесплатные AI сигналы LONG/SHORT. SMC Order Blocks, Fair Value Gaps, OTE-входы, HTF Bias. Groq AI.',
  },
  alternates: {
    canonical: '/',
    languages: { 'ru': '/', 'en': '/', 'kk': '/' },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'KotvukAI',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web Browser',
  url: SITE_URL,
  description: 'Бесплатный AI-аналитик криптовалютных графиков. Автоматические сигналы LONG/SHORT, SMC (Order Blocks, FVG, Liquidity), OTE-входы, мультитаймфреймный HTF Bias, торговый журнал.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  featureList: [
    '4-шаговый AI-анализ криптовалютных графиков (Groq moonshotai/kimi-k2)',
    'Автоматические сигналы LONG/SHORT с R:R мин. 1:1.5',
    'Smart Money Concepts: Order Blocks, Fair Value Gaps, Liquidity',
    'Break of Structure / Change of Character',
    'Fibonacci Retracement',
    'Торговый журнал с PnL',
    'OTE-входы 62-79% в зону Order Block',
    'Мультитаймфреймный HTF Bias анализ',
  ],
  inLanguage: ['ru', 'en', 'kk'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
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
