import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Политика конфиденциальности',
  description: 'Политика конфиденциальности платформы KotvukAI — как мы собираем, используем и защищаем ваши данные.',
  alternates: { canonical: '/privacy' },
}

const s: React.CSSProperties = {
  background: '#080808', minHeight: '100vh', color: '#d0d0d0',
  fontFamily: "'Geist Mono', monospace",
}
const container: React.CSSProperties = { maxWidth: 760, margin: '0 auto', padding: '60px 32px' }
const h1s: React.CSSProperties = { fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '2rem', color: '#fff', marginBottom: 8, letterSpacing: '-0.02em' }
const h2s: React.CSSProperties = { fontSize: '.85rem', fontWeight: 700, color: '#e0e0e0', margin: '36px 0 10px' }
const ps: React.CSSProperties = { fontSize: '.72rem', color: '#555', lineHeight: 1.85, marginBottom: 12 }
const uls: React.CSSProperties = { fontSize: '.72rem', color: '#555', lineHeight: 1.85, paddingLeft: 20, marginBottom: 12 }

export default function PrivacyPage() {
  return (
    <div style={s}>
      <div style={container}>
        <Link href="/" style={{ fontSize: '.65rem', color: '#444', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 40 }}>
          ← На главную
        </Link>

        <h1 style={h1s}>Политика конфиденциальности</h1>
        <p style={{ fontSize: '.65rem', color: '#333', marginBottom: 40 }}>Последнее обновление: 2026 г.</p>

        <h2 style={h2s}>1. Общие положения</h2>
        <p style={ps}>
          KotvukAI («мы», «наш», «платформа») — веб-приложение для анализа криптовалютных рынков с использованием
          искусственного интеллекта. Настоящая политика описывает, какие данные мы собираем, как используем и защищаем их.
        </p>

        <h2 style={h2s}>2. Какие данные мы собираем</h2>
        <p style={ps}>При регистрации и использовании платформы мы можем получать следующие данные:</p>
        <ul style={uls}>
          <li>Адрес электронной почты и имя (при регистрации через Firebase Authentication)</li>
          <li>Данные входа через Google SSO (имя, email, фото профиля — только если вы выбираете этот способ)</li>
          <li>Записи торгового журнала, добавленные вами вручную</li>
          <li>История AI-сигналов (пара, таймфрейм, вердикт, дата) — хранится в базе данных Neon PostgreSQL</li>
        </ul>

        <h2 style={h2s}>3. AI-анализ и конфиденциальность</h2>
        <p style={ps}>
          KotvukAI использует внешний <strong style={{ color: '#e0e0e0' }}>AI-провайдер</strong> для обработки запросов анализа.
          Это означает:
        </p>
        <ul style={uls}>
          <li>AI-запросы обрабатываются через серверы стороннего AI-провайдера. Провайдер не хранит запросы дольше 24 часов согласно их политике конфиденциальности</li>
          <li>Мы не передаём ваши персональные данные в AI-запросы — только рыночные данные (цены, свечи)</li>
          <li>Рыночные данные загружаются с Binance Futures API через наши серверы</li>
        </ul>

        <h2 style={h2s}>4. Использование данных</h2>
        <p style={ps}>Собранные данные используются исключительно для:</p>
        <ul style={uls}>
          <li>Идентификации пользователя и предоставления доступа к платформе</li>
          <li>Хранения вашего торгового журнала и истории сигналов</li>
          <li>Улучшения работы платформы</li>
        </ul>
        <p style={ps}>Мы <strong style={{ color: '#e0e0e0' }}>не продаём</strong> и <strong style={{ color: '#e0e0e0' }}>не передаём</strong> ваши данные третьим лицам.</p>

        <h2 style={h2s}>5. Сторонние сервисы</h2>
        <ul style={uls}>
          <li><strong style={{ color: '#e0e0e0' }}>Firebase Authentication (Google)</strong> — управление аутентификацией. Политика конфиденциальности Google применяется при использовании Google SSO.</li>
          <li><strong style={{ color: '#e0e0e0' }}>Neon PostgreSQL</strong> — облачная база данных для хранения журнала и истории сигналов.</li>
          <li><strong style={{ color: '#e0e0e0' }}>Binance Futures API</strong> — рыночные данные (OHLCV, Funding Rate). Используется только для получения котировок.</li>
        </ul>

        <h2 style={h2s}>6. Файлы cookie</h2>
        <p style={ps}>
          Мы используем минимальный набор технических cookie для поддержания сессии аутентификации Firebase.
          Маркетинговые и аналитические cookie не используются.
        </p>

        <h2 style={h2s}>7. Безопасность</h2>
        <p style={ps}>
          Платформа использует HTTPS, заголовки безопасности (HSTS, X-Frame-Options, CSP) и Firebase Authentication
          для защиты вашего аккаунта. Пароли хранятся в Firebase в зашифрованном виде.
        </p>

        <h2 style={h2s}>8. Ваши права</h2>
        <p style={ps}>Вы вправе запросить удаление вашего аккаунта и всех связанных данных, обратившись через GitHub Issues
          проекта. Удаление выполняется в течение 30 дней.</p>

        <h2 style={h2s}>9. Контакт</h2>
        <p style={ps}>
          По вопросам конфиденциальности обращайтесь через репозиторий проекта на GitHub.
        </p>

        <div style={{ marginTop: 60, paddingTop: 24, borderTop: '1px solid #1a1a1a' }}>
          <Link href="/" style={{ fontSize: '.65rem', color: '#444', textDecoration: 'none' }}>← Вернуться на главную</Link>
        </div>
      </div>
    </div>
  )
}
