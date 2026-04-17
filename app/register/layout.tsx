import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Регистрация — KotvukAI',
  description: 'Создайте аккаунт KotvukAI и начните ИИ-анализ криптовалютных графиков бесплатно.',
  robots: { index: false, follow: false },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
