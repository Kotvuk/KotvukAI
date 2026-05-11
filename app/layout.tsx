import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { LangProvider } from '@/contexts/LangContext'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kotvuk.asia'

export const viewport: Viewport = {
  themeColor: '#0a0f1e',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'KotvukAI — AI-анализ криптовалют | Сигналы LONG/SHORT бесплатно',
    template: '%s | KotvukAI',
  },
  description: 'AI-аналитик криптовалют. Автоматические сигналы LONG/SHORT, SMC Order Blocks, Fair Value Gaps, OTE-входы, 3-шаговый анализ.',
  keywords: ['AI анализ криптовалют', 'крипто сигналы', 'Smart Money Concepts', 'Order Blocks', 'Fair Value Gap', 'Bitcoin анализ', 'KotvukAI', 'crypto AI', 'SMC trading', 'LONG SHORT сигналы', 'криптовалюта'],
  authors: [{ name: 'KotvukAI', url: SITE_URL }],
  creator: 'KotvukAI',
  publisher: 'KotvukAI',
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    alternateLocale: ['en_US', 'kk_KZ'],
    url: SITE_URL,
    siteName: 'KotvukAI',
    title: 'KotvukAI — AI-анализ криптовалют | Сигналы LONG/SHORT',
    description: 'Бесплатный AI-аналитик криптовалют. SMC Order Blocks, FVG, сигналы LONG/SHORT, торговый журнал. Мультитаймфреймный анализ.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'KotvukAI — AI crypto analysis' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KotvukAI — AI-анализ криптовалют',
    description: 'Бесплатные AI сигналы LONG/SHORT. SMC Order Blocks, Fair Value Gaps, OTE-входы, HTF Bias.',
    images: ['/og-image.png'],
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
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: '/favicon.svg',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'KotvukAI',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web Browser',
  url: SITE_URL,
  description: 'AI-аналитик криптовалютных графиков. 6-метод анализ: SMC, индикаторы, Price Action, Wyckoff, Volume Profile, Funding Rate. Консенсус 3/6 методов.',
  offers: [
    { '@type': 'Offer', name: 'Free',    price: '0',   priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Starter', price: '9',   priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Pro',     price: '19',  priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Elite',   price: '49',  priceCurrency: 'USD' },
  ],
  featureList: [
    '6-метод анализ с консенсусом 3/6 (SMC + индикаторы + Price Action + Wyckoff + Volume Profile + Funding Rate)',
    'AI-синтез — финальный сигнал LONG/SHORT/WAIT',
    'Smart Money Concepts: Order Blocks, Fair Value Gaps, Liquidity',
    'Break of Structure / Change of Character',
    'OTE-входы 62-79% в зону Order Block',
    'Мультитаймфреймный HTF Bias анализ',
    'Торговый журнал с PnL, авто-верификация сигналов',
    'Telegram-уведомления и автоматический анализ каждые 5 минут',
  ],
  inLanguage: ['ru', 'en', 'kk'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
