'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useMarket } from '@/contexts/MarketContext'
import { useLang } from '@/contexts/LangContext'

const IVORY = '#f3efe3'
const IVORY2 = '#ece7d7'
const LINE = '#d9d1ba'
const INK = '#1f2d26'
const EMER = '#0c6b4d'
const EMER2 = '#0d7a52'
const GOLD = '#9a7426'
const MUT = '#6b6a55'
const RED = '#a12f44'
const SERIF = "'Cormorant Garamond',Georgia,serif"
const MONO = "'Geist Mono',ui-monospace,monospace"

const FX_PAIRS = [
  { sym: 'EUR/USD', key: 'EUR/USD' }, { sym: 'GBP/USD', key: 'GBP/USD' },
  { sym: 'USD/JPY', key: 'USD/JPY' }, { sym: 'AUD/USD', key: 'AUD/USD' },
  { sym: 'USD/CAD', key: 'USD/CAD' }, { sym: 'USD/CHF', key: 'USD/CHF' },
  { sym: 'NZD/USD', key: 'NZD/USD' }, { sym: 'EUR/GBP', key: 'EUR/GBP' },
  { sym: 'EUR/JPY', key: 'EUR/JPY' }, { sym: 'GBP/JPY', key: 'GBP/JPY' },
]

type Lang = 'ru' | 'en' | 'kz'

interface FT {
  openTerminal: string; login: string; toCrypto: string; toCryptoFoot: string
  kicker: string; h1a: string; h1b: string; h1c: string; heroDesc: string
  stats: [string, string, string, string]
  featKicker: string; featH2: string; feats: { t: string; d: string }[]
  howKicker: string; howH2: string; steps: { t: string; d: string }[]
  ctaA: string; ctaB: string; ctaDesc: string; ctaBtn: string
  footTag: string; sessActive: string; lblNow: string; lblUpnl: string; lblConf: string
}

const T: Record<Lang, FT> = {
  ru: {
    openTerminal: 'Открыть терминал', login: 'Войти', toCrypto: '← к крипто-режиму', toCryptoFoot: 'Перейти к крипто-режиму →',
    kicker: 'Терминал валютного анализа', h1a: 'ИИ читает', h1b: 'валютные рынки.', h1c: 'Вы принимаете решения.',
    heroDesc: 'Сигналы по мажорам и кроссам с точкой входа, TP и SL. Шесть методов анализа, экономический календарь, торговые сессии Лондона и Нью-Йорка. Уведомления в Telegram.',
    stats: ['валютных пар', 'методов анализа', 'торговые сессии', 'мониторинг рынка'],
    featKicker: 'Что внутри', featH2: 'Инструмент, собранный под валютный рынок',
    feats: [
      { t: 'Шесть методов', d: 'SMC, Price Action, Derivatives, Volume Profile, индикаторы и Funding — консенсус, а не одно мнение.' },
      { t: 'Экономический календарь', d: 'Красные новости блокируют торговлю ±1ч. NFP, ставки ЦБ, инфляция — отмечены по важности.' },
      { t: 'Торговые сессии', d: 'Азия, Лондон, Нью-Йорк с таймерами. Сигналы только в активные часы ликвидности.' },
      { t: 'Точные уровни', d: 'Каждый сигнал — вход, take-profit, stop-loss и плечо. Ничего не нужно додумывать.' },
      { t: 'Telegram-уведомления', d: 'Сигнал и его результат приходят мгновенно. Виден путь сделки от входа до выхода.' },
      { t: 'Списки доверия пар', d: 'Пары с серией убытков уходят в серый и чёрный список — система сама фильтрует слабое.' },
    ],
    howKicker: 'Как это работает', howH2: 'Три шага до сигнала',
    steps: [
      { t: 'Сканирование сессий', d: 'Бот анализирует 10 валютных пар в активные часы Лондона и Нью-Йорка, пропуская тихую Азию и красные новости.' },
      { t: 'Консенсус методов', d: 'Шесть независимых методов голосуют за направление. Сигнал рождается только при достаточном числе подтверждений.' },
      { t: 'Готовый сигнал', d: 'Вход, TP, SL, плечо и уверенность приходят в терминал и в Telegram. Дальше решение за вами.' },
    ],
    ctaA: 'Откройте', ctaB: 'валютный терминал', ctaDesc: 'Тот же движок, что анализирует крипто-рынок круглосуточно — теперь настроен на валютные пары и сессии.', ctaBtn: 'Начать бесплатно',
    footTag: 'валютный анализ', sessActive: '● ЛОНДОН · АКТИВНА', lblNow: 'ЦЕНА СЕЙЧАС', lblUpnl: 'НЕРЕАЛИЗ. PNL', lblConf: 'УВЕРЕН.',
  },
  en: {
    openTerminal: 'Open terminal', login: 'Sign in', toCrypto: '← to crypto mode', toCryptoFoot: 'Switch to crypto mode →',
    kicker: 'Currency analysis terminal', h1a: 'AI reads', h1b: 'the currency markets.', h1c: 'You make the calls.',
    heroDesc: 'Signals on majors and crosses with entry, TP and SL. Six analysis methods, economic calendar, London and New York sessions. Telegram alerts.',
    stats: ['currency pairs', 'analysis methods', 'trading sessions', 'market monitoring'],
    featKicker: 'What\'s inside', featH2: 'A tool built for the currency market',
    feats: [
      { t: 'Six methods', d: 'SMC, Price Action, Derivatives, Volume Profile, indicators and Funding — consensus, not a single opinion.' },
      { t: 'Economic calendar', d: 'Red news blocks trading ±1h. NFP, central-bank rates, inflation — flagged by importance.' },
      { t: 'Trading sessions', d: 'Asia, London, New York with timers. Signals only during active liquidity hours.' },
      { t: 'Precise levels', d: 'Every signal carries entry, take-profit, stop-loss and leverage. Nothing left to guess.' },
      { t: 'Telegram alerts', d: 'The signal and its outcome arrive instantly. See the trade path from entry to exit.' },
      { t: 'Pair trust tiers', d: 'Pairs on a losing streak drop to grey and black lists — the system filters out the weak.' },
    ],
    howKicker: 'How it works', howH2: 'Three steps to a signal',
    steps: [
      { t: 'Session scan', d: 'The bot analyzes 10 currency pairs during active London and New York hours, skipping quiet Asia and red news.' },
      { t: 'Method consensus', d: 'Six independent methods vote on direction. A signal is born only with enough confirmations.' },
      { t: 'Ready signal', d: 'Entry, TP, SL, leverage and confidence arrive in the terminal and Telegram. The decision is yours.' },
    ],
    ctaA: 'Open the', ctaB: 'currency terminal', ctaDesc: 'The same engine that watches the crypto market around the clock — now tuned for currency pairs and sessions.', ctaBtn: 'Start free',
    footTag: 'currency analysis', sessActive: '● LONDON · ACTIVE', lblNow: 'PRICE NOW', lblUpnl: 'UNREALIZED PNL', lblConf: 'CONF.',
  },
  kz: {
    openTerminal: 'Терминалды ашу', login: 'Кіру', toCrypto: '← крипто режіміне', toCryptoFoot: 'Крипто режіміне өту →',
    kicker: 'Валюталық талдау терминалы', h1a: 'AI валюта', h1b: 'нарықтарын оқиды.', h1c: 'Шешімді сіз қабылдайсыз.',
    heroDesc: 'Мажорлар мен кросстар бойынша кіру нүктесі, TP және SL бар сигналдар. Алты талдау әдісі, экономикалық күнтізбе, Лондон және Нью-Йорк сессиялары. Telegram хабарламалары.',
    stats: ['валюта жұбы', 'талдау әдісі', 'сауда сессиясы', 'нарық мониторингі'],
    featKicker: 'Ішінде не бар', featH2: 'Валюта нарығына арналған құрал',
    feats: [
      { t: 'Алты әдіс', d: 'SMC, Price Action, Derivatives, Volume Profile, индикаторлар және Funding — бір пікір емес, консенсус.' },
      { t: 'Экономикалық күнтізбе', d: 'Қызыл жаңалықтар саудаға ±1сағ тыйым салады. NFP, ставкалар, инфляция — маңыздылығы бойынша белгіленген.' },
      { t: 'Сауда сессиялары', d: 'Азия, Лондон, Нью-Йорк таймерлермен. Сигналдар тек белсенді өтімділік сағаттарында.' },
      { t: 'Нақты деңгейлер', d: 'Әр сигналда кіру, take-profit, stop-loss және иық бар. Ештеңе ойлап табудың қажеті жоқ.' },
      { t: 'Telegram хабарламалары', d: 'Сигнал мен оның нәтижесі бірден келеді. Мәміленің кіруден шығуға дейінгі жолы көрінеді.' },
      { t: 'Жұптарға сенім тізімдері', d: 'Зиян сериясындағы жұптар сұр және қара тізімге өтеді — жүйе әлсізді өзі сүзеді.' },
    ],
    howKicker: 'Бұл қалай жұмыс істейді', howH2: 'Сигналға дейін үш қадам',
    steps: [
      { t: 'Сессияларды сканерлеу', d: 'Бот Лондон мен Нью-Йорктың белсенді сағаттарында 10 валюта жұбын талдайды, тыныш Азия мен қызыл жаңалықтарды өткізіп жібереді.' },
      { t: 'Әдістер консенсусы', d: 'Алты тәуелсіз әдіс бағытқа дауыс береді. Сигнал жеткілікті растаулар болғанда ғана туады.' },
      { t: 'Дайын сигнал', d: 'Кіру, TP, SL, иық пен сенімділік терминалға және Telegram-ға келеді. Әрі қарай шешім сізде.' },
    ],
    ctaA: 'Валюталық', ctaB: 'терминалды ашыңыз', ctaDesc: 'Крипто нарығын тәулік бойы талдайтын сол қозғалтқыш — енді валюта жұптары мен сессияларға бапталған.', ctaBtn: 'Тегін бастау',
    footTag: 'валюталық талдау', sessActive: '● ЛОНДОН · БЕЛСЕНДІ', lblNow: 'ҚАЗІРГІ БАҒА', lblUpnl: 'ІСКЕ АСПАҒАН PNL', lblConf: 'СЕНІМ.',
  },
}

const LANGS = [{ code: 'ru', label: 'RU' }, { code: 'en', label: 'EN' }, { code: 'kz', label: 'KZ' }] as const

function FxLangSwitch() {
  const { lang, setLang } = useLang()
  return (
    <div style={{ display: 'inline-flex', gap: 2, padding: 3, border: `1px solid ${LINE}`, borderRadius: 7, fontFamily: MONO }}>
      {LANGS.map(l => {
        const on = l.code === lang
        return (
          <button key={l.code} onClick={() => setLang(l.code)}
            style={{ padding: '4px 9px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: '.7rem', fontWeight: 600, letterSpacing: '.03em', background: on ? EMER : 'transparent', color: on ? IVORY : MUT, transition: 'background .15s, color .15s' }}>
            {l.label}
          </button>
        )
      })}
    </div>
  )
}

function useInView(threshold = 0.18) {
  const ref = useRef<HTMLDivElement>(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect() } }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, vis }
}

export default function ForexLanding() {
  const { setMarket } = useMarket()
  const { lang, t } = useLang()
  const tr = T[lang]
  const [rates, setRates] = useState<Record<string, { price: number; change: number }>>({})

  useEffect(() => {
    const load = () => fetch('/api/ticker?market=forex').then(r => r.ok ? r.json() : null).then(d => { if (d) setRates(d) }).catch(() => {})
    load()
    const iv = setInterval(load, 60000)
    return () => clearInterval(iv)
  }, [])

  const feat = useInView()
  const how = useInView()
  const statVals = ['10', '6', '3', '24/5']

  return (
    <div style={{ minHeight: '100vh', background: IVORY, color: INK, fontFamily: SERIF, overflowX: 'hidden' }}>
      <style>{`
        @keyframes fxRise { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fxMarq { from { transform:translateX(0) } to { transform:translateX(-50%) } }
        .fxl-rise { animation: fxRise .9s ease both }
        .fxl-nav-link:hover { color:${EMER} !important }
        .fxl-cta:hover { background:${EMER2} !important }
        .fxl-ghost:hover { border-color:${EMER} !important; color:${EMER} !important }
      `}</style>

      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: 60, borderBottom: `1px solid ${LINE}`, background: 'rgba(243,239,227,.9)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 50, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
          <span style={{ width: 14, height: 14, background: EMER, display: 'inline-block', clipPath: 'polygon(50% 0%,100% 50%,50% 100%,0% 50%)', alignSelf: 'center' }} />
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: INK, letterSpacing: '.01em' }}>Kotvuk<span style={{ color: EMER }}>AI</span></span>
          <span style={{ fontStyle: 'italic', fontWeight: 700, fontSize: '.72rem', color: GOLD, border: `1px solid ${GOLD}66`, borderRadius: 999, padding: '2px 9px', letterSpacing: '.12em' }}>FX</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ display: 'inline-flex', border: `1px solid ${LINE}`, borderRadius: 999, overflow: 'hidden', fontFamily: MONO }}>
            <button onClick={() => setMarket('crypto')} style={{ border: 'none', background: 'transparent', color: MUT, cursor: 'pointer', padding: '6px 12px', fontSize: '.6rem', fontWeight: 600, letterSpacing: '.08em' }}>CRYPTO</button>
            <button style={{ border: 'none', background: EMER, color: IVORY, cursor: 'default', padding: '6px 12px', fontSize: '.6rem', fontWeight: 600, letterSpacing: '.08em' }}>FX</button>
          </div>
          <FxLangSwitch />
          <Link href="/login" className="fxl-ghost" style={{ display: 'inline-block', padding: '7px 16px', fontSize: '.7rem', border: `1px solid ${LINE}`, color: MUT, textDecoration: 'none', borderRadius: 4, fontFamily: MONO, letterSpacing: '.06em', minWidth: 74, textAlign: 'center', boxSizing: 'border-box' }}>{t('lp_login_btn')}</Link>
          <Link href="/register" className="fxl-cta" style={{ display: 'inline-block', padding: '7px 16px', fontSize: '.7rem', background: EMER, color: IVORY, fontWeight: 600, textDecoration: 'none', borderRadius: 4, fontFamily: MONO, letterSpacing: '.06em', minWidth: 120, textAlign: 'center', boxSizing: 'border-box' }}>{t('lp_start_btn')}</Link>
        </div>
      </nav>

      <div style={{ borderBottom: `1px solid ${LINE}`, background: IVORY2, overflow: 'hidden', whiteSpace: 'nowrap', position: 'relative' }}>
        <div style={{ display: 'inline-flex', gap: 32, padding: '9px 0', fontFamily: MONO, fontSize: '.66rem', animation: 'fxMarq 40s linear infinite' }}>
          {[...FX_PAIRS, ...FX_PAIRS].map((p, i) => {
            const r = rates[p.key]
            const up = (r?.change ?? 0) >= 0
            return (
              <span key={i} style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}>
                <span style={{ color: INK, fontWeight: 500 }}>{p.sym}</span>
                <span style={{ color: MUT }}>{r ? r.price.toFixed(p.sym.includes('JPY') ? 3 : 5) : '—'}</span>
                {r && <span style={{ color: up ? EMER2 : RED }}>{up ? '▲' : '▼'} {Math.abs(r.change).toFixed(2)}%</span>}
                <span style={{ width: 1, height: 11, background: LINE, display: 'inline-block', marginLeft: 8 }} />
              </span>
            )
          })}
        </div>
      </div>

      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '90px 32px 70px', display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,.95fr)', gap: 56, alignItems: 'center' }} className="fxl-hero">
        <div className="fxl-rise">
          <div style={{ fontFamily: MONO, fontSize: '.66rem', letterSpacing: '.2em', color: EMER, textTransform: 'uppercase', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 18, height: 1, background: EMER }} /> {tr.kicker}
          </div>
          <h1 style={{ fontSize: 'clamp(2.6rem,5vw,4.3rem)', lineHeight: 1.04, fontWeight: 700, letterSpacing: '-.01em', marginBottom: 22 }}>
            {tr.h1a}<br />{tr.h1b}<br /><span style={{ fontStyle: 'italic', color: EMER }}>{tr.h1c}</span>
          </h1>
          <p style={{ fontFamily: MONO, fontSize: '.84rem', lineHeight: 1.85, color: MUT, maxWidth: 440, marginBottom: 34 }}>{tr.heroDesc}</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" className="fxl-cta" style={{ padding: '13px 30px', background: EMER, color: IVORY, fontWeight: 500, fontSize: '.92rem', textDecoration: 'none', borderRadius: 4, fontFamily: SERIF, letterSpacing: '.02em' }}>{tr.openTerminal}</Link>
            <button onClick={() => setMarket('crypto')} className="fxl-ghost" style={{ padding: '13px 26px', border: `1px solid ${LINE}`, background: 'transparent', color: MUT, fontSize: '.84rem', cursor: 'pointer', borderRadius: 4, fontFamily: MONO, letterSpacing: '.04em' }}>{tr.toCrypto}</button>
          </div>
        </div>
        <div className="fxl-rise" style={{ animationDelay: '.15s' }}>
          <FxTerminalPreview rates={rates} tr={tr} />
        </div>
      </section>

      <section style={{ borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, background: IVORY2 }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '34px 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 28 }}>
          {tr.stats.map((l, i) => (
            <div key={l}>
              <div style={{ fontSize: '2.4rem', fontStyle: 'italic', color: EMER, lineHeight: 1 }}>{statVals[i]}</div>
              <div style={{ fontFamily: MONO, fontSize: '.62rem', letterSpacing: '.1em', color: MUT, marginTop: 6, textTransform: 'uppercase' }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      <section ref={feat.ref} style={{ maxWidth: 1080, margin: '0 auto', padding: '80px 32px', opacity: feat.vis ? 1 : 0, transform: feat.vis ? 'none' : 'translateY(18px)', transition: 'opacity .8s, transform .8s' }}>
        <div style={{ fontFamily: MONO, fontSize: '.62rem', letterSpacing: '.2em', color: GOLD, textTransform: 'uppercase', marginBottom: 10 }}>{tr.featKicker}</div>
        <h2 style={{ fontSize: 'clamp(1.8rem,3.5vw,2.7rem)', fontWeight: 700, marginBottom: 40, maxWidth: 600 }}>{tr.featH2}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 1, background: LINE, border: `1px solid ${LINE}` }}>
          {tr.feats.map(f => (
            <div key={f.t} style={{ background: IVORY, padding: '26px 24px' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 9, color: INK }}>{f.t}</div>
              <div style={{ fontFamily: MONO, fontSize: '.72rem', lineHeight: 1.8, color: MUT }}>{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section ref={how.ref} style={{ background: INK, color: IVORY, opacity: how.vis ? 1 : 0, transition: 'opacity .8s' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '80px 32px' }}>
          <div style={{ fontFamily: MONO, fontSize: '.62rem', letterSpacing: '.2em', color: '#c9a356', textTransform: 'uppercase', marginBottom: 10 }}>{tr.howKicker}</div>
          <h2 style={{ fontSize: 'clamp(1.8rem,3.5vw,2.7rem)', fontWeight: 700, marginBottom: 44, color: IVORY }}>{tr.howH2}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 40 }}>
            {tr.steps.map((s, i) => (
              <div key={s.t}>
                <div style={{ fontSize: '2.6rem', fontStyle: 'italic', color: '#c9a356', lineHeight: 1, marginBottom: 14 }}>{'0' + (i + 1)}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 10, color: IVORY }}>{s.t}</div>
                <div style={{ fontFamily: MONO, fontSize: '.74rem', lineHeight: 1.85, color: '#b8b6a0' }}>{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 760, margin: '0 auto', padding: '90px 32px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(2rem,4vw,3.2rem)', fontWeight: 700, lineHeight: 1.1, marginBottom: 20 }}>
          {tr.ctaA} <span style={{ fontStyle: 'italic', color: EMER }}>{tr.ctaB}</span>
        </h2>
        <p style={{ fontFamily: MONO, fontSize: '.82rem', color: MUT, lineHeight: 1.8, maxWidth: 460, margin: '0 auto 32px' }}>{tr.ctaDesc}</p>
        <Link href="/register" className="fxl-cta" style={{ display: 'inline-block', padding: '15px 42px', background: EMER, color: IVORY, fontWeight: 500, fontSize: '1rem', textDecoration: 'none', borderRadius: 4, letterSpacing: '.02em' }}>{tr.ctaBtn}</Link>
      </section>

      <footer style={{ borderTop: `1px solid ${LINE}`, background: IVORY2 }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '26px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontFamily: MONO, fontSize: '.66rem', color: MUT }}>
          <span>KotvukAI <span style={{ fontStyle: 'italic', fontFamily: SERIF, color: GOLD }}>FX</span> · {tr.footTag}</span>
          <button onClick={() => setMarket('crypto')} className="fxl-nav-link" style={{ background: 'none', border: 'none', color: MUT, cursor: 'pointer', fontFamily: MONO, fontSize: '.66rem' }}>{tr.toCryptoFoot}</button>
        </div>
      </footer>
    </div>
  )
}

function FxTerminalPreview({ rates, tr }: { rates: Record<string, { price: number; change: number }>; tr: FT }) {
  const eur = rates['EUR/USD']?.price
  const [px, setPx] = useState(1.0842)
  useEffect(() => { if (eur) setPx(eur) }, [eur])
  useEffect(() => {
    const iv = setInterval(() => setPx(p => Math.max(1.082, Math.min(1.087, p + (Math.random() - 0.48) * 0.00014))), 1400)
    return () => clearInterval(iv)
  }, [])
  const entry = 1.0838
  const pnl = ((px - entry) / entry) * 100 * 10
  const up = pnl >= 0
  const bars = [46, 60, 38, 52, 30, 64, 72, 50, 80, 58, 88, 66, 54, 70]
  return (
    <div style={{ background: IVORY, border: `1px solid ${LINE}`, borderRadius: 6, boxShadow: '0 24px 60px rgba(31,45,38,.1)', overflow: 'hidden', fontFamily: SERIF }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${LINE}`, background: IVORY2 }}>
        <span style={{ fontFamily: MONO, fontSize: '.6rem', color: EMER, letterSpacing: '.1em' }}>{tr.sessActive}</span>
        <span style={{ fontSize: '.95rem', color: INK }}>EUR/USD <span style={{ fontStyle: 'italic', color: EMER, fontSize: '.78rem' }}>long</span></span>
      </div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 64, padding: '14px 16px 8px', borderBottom: `1px solid ${LINE}` }}>
        {bars.map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, background: (i % 3 === 2) ? RED : EMER2, opacity: .85, borderRadius: 1 }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: `1px solid ${LINE}` }}>
        {[
          { l: 'ВХОД / ENTRY', v: '1.08380', c: MUT }, { l: 'TP', v: '1.08710', c: EMER2 }, { l: 'SL', v: '1.08220', c: RED },
        ].map((x, i) => (
          <div key={x.l} style={{ padding: '12px 16px', borderRight: i < 2 ? `1px solid ${LINE}` : 'none' }}>
            <div style={{ fontFamily: MONO, fontSize: '.5rem', letterSpacing: '.08em', color: MUT }}>{i === 0 ? 'ENTRY' : x.l}</div>
            <div style={{ fontFamily: MONO, fontSize: '.86rem', color: x.c, marginTop: 3 }}>{x.v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: '.5rem', letterSpacing: '.08em', color: MUT }}>{tr.lblNow}</div>
          <div style={{ fontFamily: MONO, fontSize: '.95rem', color: INK }}>{px.toFixed(5)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: MONO, fontSize: '.5rem', letterSpacing: '.08em', color: MUT }}>{tr.lblUpnl}</div>
          <div style={{ fontSize: '1.05rem', fontStyle: 'italic', color: up ? EMER2 : RED }}>{up ? '+' : '−'}{Math.abs(pnl).toFixed(2)}%</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: MONO, fontSize: '.5rem', letterSpacing: '.08em', color: MUT }}>{tr.lblConf}</div>
          <div style={{ fontSize: '1.05rem', fontStyle: 'italic', color: GOLD }}>58%</div>
        </div>
      </div>
    </div>
  )
}
