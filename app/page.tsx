'use client'
import { useEffect, useRef, useState } from 'react'
import { useLang } from '@/contexts/LangContext'
import Link from 'next/link'
import LangSwitcher from '@/components/ui/LangSwitcher'
import Logo from '@/components/app/Logo'

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const { ref, visible } = useInView(0.3)
  useEffect(() => {
    if (!visible) return
    let cur = 0
    const step = Math.ceil(target / 40)
    const id = setInterval(() => {
      cur += step
      if (cur >= target) { setVal(target); clearInterval(id) } else setVal(cur)
    }, 30)
    return () => clearInterval(id)
  }, [visible, target])
  return <span ref={ref}>{val}{suffix}</span>
}

const TICKER_SYMS = [
  { sym: 'BTC/USDT', key: 'BTCUSDT' },
  { sym: 'ETH/USDT', key: 'ETHUSDT' },
  { sym: 'SOL/USDT', key: 'SOLUSDT' },
  { sym: 'BNB/USDT', key: 'BNBUSDT' },
  { sym: 'XRP/USDT', key: 'XRPUSDT' },
  { sym: 'AVAX/USDT', key: 'AVAXUSDT' },
  { sym: 'DOGE/USDT', key: 'DOGEUSDT' },
  { sym: 'LINK/USDT', key: 'LINKUSDT' },
  { sym: 'ADA/USDT', key: 'ADAUSDT' },
  { sym: 'DOT/USDT', key: 'DOTUSDT' },
  { sym: 'TRX/USDT', key: 'TRXUSDT' },
  { sym: 'LTC/USDT', key: 'LTCUSDT' },
  { sym: 'ATOM/USDT', key: 'ATOMUSDT' },
  { sym: 'POL/USDT', key: 'POLUSDT' },
]
type TickerMap = Record<string, { price: number; change: number }>

function useLiveTicker(): TickerMap {
  const [tickers, setTickers] = useState<TickerMap>({})
  useEffect(() => {
    fetch('/api/ticker')
      .then(r => r.json()).then(d => setTickers(d)).catch(() => {})
  }, [])
  return tickers
}

const BAR_H = [35,45,30,55,40,62,38,70,45,58,42,75,50,65,38,80,55,68,44,72,48,82,56,70,42,78,52,88,60,76,46,84,58,74,44,80,50,88,55,92,48,78,52,85,45,76,50,82,45,68]

function SignalMockupInner() {
  const { t } = useLang()
  const [st1, setSt1] = useState({ vis: false, done: false })
  const [st2, setSt2] = useState({ vis: false, done: false })
  const [st3, setSt3] = useState({ vis: false, done: false, run: false })
  const [fills, setFills] = useState([0, 0, 0])
  const [levVis, setLevVis] = useState([false, false, false])
  const [confW, setConfW] = useState(0)

  useEffect(() => {
    const ids: ReturnType<typeof setTimeout>[] = []
    ids.push(setTimeout(() => { setSt1({ vis: true, done: true }); setFills(f => [100, f[1], f[2]]) }, 400))
    ids.push(setTimeout(() => { setSt2({ vis: true, done: true }); setFills(f => [f[0], 100, f[2]]) }, 1100))
    ids.push(setTimeout(() => { setSt3({ vis: true, done: false, run: true }); setFills(f => [f[0], f[1], 60]) }, 1800))
    ids.push(setTimeout(() => { setSt3({ vis: true, done: true, run: false }); setFills(f => [f[0], f[1], 100]) }, 3000))
    ids.push(setTimeout(() => setLevVis([true, false, false]), 3300))
    ids.push(setTimeout(() => setConfW(78), 3400))
    ids.push(setTimeout(() => setLevVis([true, true, false]), 3500))
    ids.push(setTimeout(() => setLevVis([true, true, true]), 3700))
    return () => ids.forEach(clearTimeout)
  }, [])

  const stRow = (vis: boolean, done: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10, fontSize: '.76rem',
    color: done ? '#c8d4e0' : '#4a5568', opacity: vis ? 1 : 0,
    transform: vis ? 'translateX(0)' : 'translateX(-8px)',
    transition: 'opacity .4s, transform .4s, color .3s', marginBottom: 10,
  })
  const iconSt = (done: boolean, run: boolean): React.CSSProperties => ({
    width: 18, height: 18, borderRadius: '50%',
    border: `1px solid ${done ? '#00e676' : run ? '#00d4ff' : '#4a5568'}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '.6rem', flexShrink: 0, background: done ? '#00e676' : 'none',
    color: done ? '#000' : 'inherit', animation: run ? 'spin-ring 1s linear infinite' : 'none',
  })
  const levSt = (vis: boolean): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', gap: 3,
    opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : 'translateY(6px)',
    transition: 'opacity .4s, transform .4s',
  })

  return (
    <div style={{ width: '100%', maxWidth: 700, animation: 'fadeUp .8s .4s ease both' }} className="lp-float">
      <div style={{ background: 'rgba(10,15,30,.9)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, overflow: 'hidden', backdropFilter: 'blur(20px)', boxShadow: '0 40px 80px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '.62rem', letterSpacing: '.12em', color: '#00e676', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="lp-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#00e676', display: 'inline-block' }} />
              LIVE
            </span>
            <span style={{ fontSize: '.88rem', fontWeight: 600, color: '#fff' }}>BTC/USDT</span>
            <span style={{ fontSize: '.72rem', color: '#4a5568' }}>· 1H</span>
          </div>
          <span style={{ padding: '4px 12px', borderRadius: 4, fontSize: '.72rem', fontWeight: 700, background: 'rgba(0,230,118,.15)', color: '#00e676', border: '1px solid rgba(0,230,118,.3)', letterSpacing: '.08em' }}>LONG</span>
        </div>
        <div style={{ padding: '12px 20px 8px', display: 'flex', gap: 3, height: 72, alignItems: 'flex-end', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          {BAR_H.map((h, i) => {
            const bull = Math.sin(i * 0.4 + 1) > 0
            return <div key={i} style={{ flex: 1, height: `${h * 0.7}px`, borderRadius: 1, background: bull ? 'rgba(0,230,118,.5)' : 'rgba(255,61,87,.45)', borderTop: `1px solid ${bull ? '#00e676' : '#ff3d57'}`, transformOrigin: 'bottom', animation: `bar-grow .8s ${i * 20}ms ease both` }} />
          })}
        </div>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          {([
            { st: st1, fi: 0, label: t('lp_stage1') },
            { st: st2, fi: 1, label: t('lp_stage2') },
            { st: st3, fi: 2, label: t('lp_stage3') },
          ] as { st: { vis: boolean; done: boolean; run?: boolean }; fi: number; label: string }[]).map(({ st, fi, label }, idx) => (
            <div key={idx} style={{ ...stRow(st.vis, st.done), marginBottom: idx < 2 ? 10 : 0 }}>
              <span style={iconSt(st.done, !!(st as { run?: boolean }).run)}>{st.done ? '✓' : ''}</span>
              <span>{label}</span>
              <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,.07)', borderRadius: 1, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'linear-gradient(90deg,#00d4ff,#a855f7)', width: `${fills[fi]}%`, transition: 'width 1.2s ease' }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {([
            { vis: levVis[0], label: 'ENTRY', price: '$84,312', change: '────────', color: '#00d4ff', cc: '#4a5568' },
            { vis: levVis[1], label: 'TP', price: '$87,134', change: '▲ +3.3%', color: '#00e676', cc: '#00e676' },
            { vis: levVis[2], label: 'SL', price: '$82,968', change: '▼ -1.6%', color: '#ff3d57', cc: '#ff3d57' },
          ]).map(({ vis, label, price, change, color, cc }) => (
            <div key={label} style={levSt(vis)}>
              <span style={{ fontSize: '.62rem', color: '#4a5568', letterSpacing: '.08em' }}>{label}</span>
              <span style={{ fontSize: '.92rem', fontWeight: 600, color }}>{price}</span>
              <span style={{ fontSize: '.62rem', color: cc }}>{change}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '.68rem', color: '#4a5568' }}>{t('lp_stage_conf')}</span>
            <div style={{ width: 100, height: 3, background: 'rgba(255,255,255,.07)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg,#00d4ff,#a855f7)', width: `${confW}%`, transition: 'width 1.4s ease' }} />
            </div>
            <span style={{ fontSize: '.68rem', color: '#00d4ff', fontWeight: 600 }}>78%</span>
          </div>
          <span style={{ fontSize: '.66rem', color: '#4a5568' }}>R:R <span style={{ color: '#00e676', fontWeight: 600 }}>1:2.1</span></span>
        </div>
      </div>
    </div>
  )
}

function SignalMockup() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 12000)
    return () => clearInterval(id)
  }, [])
  return <SignalMockupInner key={tick} />
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

function Divider({ num, label }: { num: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '0 32px' }}>
      <div style={{ width: 40, height: 1, background: '#1a1a1a', flexShrink: 0 }} />
      <span style={{ fontSize: '.55rem', color: '#222', letterSpacing: '.2em', whiteSpace: 'nowrap' }}>{num} / {label}</span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,#1a1a1a,transparent)' }} />
    </div>
  )
}

export default function LandingPage() {
  const { t } = useLang()
  const heroRef = useRef<HTMLDivElement>(null)
  const [scrollY, setScrollY] = useState(0)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const liveTickers = useLiveTicker()
  const acc = '#00d4ff'
  const acc2 = '#a855f7'
  const tickerSyms = TICKER_SYMS

  const statsSection = useInView(0.2)
  const featuresSection = useInView()
  const stepsSection = useInView()
  const smcSection = useInView()
  const pricingSection = useInView(0.1)
  const ctaSection = useInView()

  useEffect(() => {
    document.body.style.overflow = 'auto'
    document.documentElement.style.overflow = 'auto'
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!privacyOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setPrivacyOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [privacyOpen])

  const NAV_LINKS = [
    { id: 'section-features', label: t('lp_nav_about') },
    { id: 'section-how', label: t('lp_nav_how') },
    { id: 'section-pricing', label: t('lp_nav_pricing') },
  ]

  const FEATURES = [
    { icon: '◈', title: t('lp_f1_title'), desc: t('lp_f1_desc'), color: '#00d4ff' },
    { icon: '◉', title: t('lp_f2_title'), desc: t('lp_f2_desc'), color: '#00e676' },
    { icon: '▦', title: t('lp_f3_title'), desc: t('lp_f3_desc'), color: '#ffb300' },
    { icon: '◉', title: t('lp_f4_title'), desc: t('lp_f4_desc'), color: '#ff6b6b' },
    { icon: '◇', title: t('lp_f5_title'), desc: t('lp_f5_desc'), color: '#a855f7' },
    { icon: '◈', title: t('lp_f6_title'), desc: t('lp_f6_desc'), color: '#34d399' },
  ]

  const STEPS = [
    { n: '01', title: t('lp_s1_title'), desc: t('lp_s1_desc'), color: '#00d4ff' },
    { n: '02', title: t('lp_s2_title'), desc: t('lp_s2_desc'), color: '#00e676' },
    { n: '03', title: t('lp_s3_title'), desc: t('lp_s3_desc'), color: '#a855f7' },
  ]

  const SMC_ITEMS = [
    { tag: 'OB',  title: t('lp_ob_title'),  desc: t('lp_ob_desc'),  color: '#00d4ff' },
    { tag: 'FVG', title: t('lp_fvg_title'), desc: t('lp_fvg_desc'), color: '#00e676' },
    { tag: 'LIQ', title: t('lp_liq_title'), desc: t('lp_liq_desc'), color: '#ffb300' },
    { tag: 'BOS', title: t('lp_bos_title'), desc: t('lp_bos_desc'), color: '#ff6b6b' },
  ]

  const PLANS = [
    {
      name: 'Free', price: '$0', period: t('lp_per_mo'), popular: false,
      desc: t('lp_p1_desc'),
      features: [t('lp_p1_f1'), t('lp_p1_f2'), t('lp_p1_f3'), t('lp_p1_f4')],
      noFeatures: [t('lp_p1_f5')],
      btn: t('lp_p1_btn'), primary: false,
    },
    {
      name: 'Starter', price: '$49.90', period: t('lp_per_mo'), popular: false,
      desc: t('lp_p2_desc'),
      features: [t('lp_p2_f1'), t('lp_p2_f2'), t('lp_p2_f3'), t('lp_p2_f4')],
      noFeatures: [t('lp_p2_f5')],
      btn: t('lp_p_choose'), primary: false,
    },
    {
      name: 'Pro', price: '$149.90', period: t('lp_per_mo'), popular: true,
      desc: t('lp_p3_desc'),
      features: [t('lp_p3_f1'), t('lp_p3_f2'), t('lp_p3_f3'), t('lp_p3_f4'), t('lp_p3_f5')],
      noFeatures: [],
      btn: t('lp_p_choose'), primary: true,
    },
    {
      name: 'Elite', price: '$399.90', period: t('lp_per_yr'), popular: false,
      desc: t('lp_p4_desc'),
      features: [t('lp_p4_f1'), t('lp_p4_f2'), t('lp_p4_f3'), t('lp_p4_f4'), t('lp_p4_f5')],
      noFeatures: [],
      btn: t('lp_p_choose'), primary: false,
    },
  ]

  const STATS = [
    { target: 500,  suffix: '+', label: t('lp_stat_pairs') },
    { target: 7,    suffix: '',  label: t('lp_stat_tfs') },
    { target: 3,    suffix: '',  label: t('lp_stat_free') },
    { target: 4,    suffix: '',  label: t('lp_stat_plans') },
  ]

  const gridBg = 'linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px)'
  const border = 'rgba(255,255,255,.07)'

  return (
    <div style={{ background: '#080808', color: '#c8d4e0', fontFamily: "'Geist Mono', monospace", overflowX: 'hidden' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: gridBg, backgroundSize: '64px 64px', pointerEvents: 'none', zIndex: 0 }} />
      <div className="lp-blob-1" />
      <div className="lp-blob-2" />

      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1, overflow: 'hidden' }}>
        <div className="lp-scanline" />
      </div>

      <div style={{ position: 'relative', zIndex: 2 }}>
        <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: 60, borderBottom: `1px solid #1a1a1a`, background: 'rgba(8,8,8,.95)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <Logo size={22} />
          </div>
          <div style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'center' }}>
            {NAV_LINKS.map(s => (
              <button key={s.id} onClick={() => scrollTo(s.id)}
                style={{ background: 'none', border: 'none', color: '#4a5568', fontSize: '.65rem', letterSpacing: '.08em', cursor: 'pointer', padding: '6px 14px', transition: 'color .15s', fontFamily: "'Geist Mono',monospace" }}
                onMouseEnter={e => (e.currentTarget.style.color = '#c8d4e0')}
                onMouseLeave={e => (e.currentTarget.style.color = '#4a5568')}
              >{s.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
            <LangSwitcher />
            <Link href="/login" className="nav-link" style={{ display: 'inline-block', padding: '7px 16px', fontSize: '.7rem', letterSpacing: '.06em', border: '1px solid #2c2c2c', color: '#888', textDecoration: 'none', minWidth: 74, textAlign: 'center', boxSizing: 'border-box' }}>{t('lp_login_btn')}</Link>
            <Link href="/register" className="cta-btn" style={{ display: 'inline-block', padding: '7px 16px', fontSize: '.7rem', letterSpacing: '.06em', background: '#00d4ff', color: '#080808', fontWeight: 700, textDecoration: 'none', minWidth: 120, textAlign: 'center', boxSizing: 'border-box' }}>{t('lp_start_btn')}</Link>
          </div>
        </nav>

        <div className="lp-ticker-wrap">
          <div className="lp-ticker-fade-l" />
          <div className="lp-ticker-fade-r" />
          <div className="lp-ticker">
            {[...tickerSyms, ...tickerSyms].map((tk, i) => {
              const live = liveTickers[tk.key]
              return (
                <span key={i} style={{ fontSize: '.68rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#c8d4e0', fontWeight: 600, letterSpacing: '.04em' }}>{tk.sym}</span>
                  <span style={{ color: '#4a5568' }}>{live ? `$${live.price.toLocaleString(undefined, { maximumFractionDigits: live.price < 1 ? 7 : 4 })}` : '—'}</span>
                  {live && <span style={{ color: live.change >= 0 ? '#00e676' : '#ff3d57', fontWeight: 600 }}>{live.change >= 0 ? '+' : ''}{live.change.toFixed(2)}%</span>}
                  <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,.08)', display: 'inline-block' }} />
                </span>
              )
            })}
          </div>
        </div>

        <section ref={heroRef} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 40px 100px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 400, background: `radial-gradient(ellipse,rgba(0,212,255,.06) 0%,transparent 70%)`, pointerEvents: 'none' }} />

          <div className="fade-up" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '.68rem', letterSpacing: '.18em', color: acc, textTransform: 'uppercase', marginBottom: 28 }}>
            <span className="lp-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: acc, display: 'inline-block' }} />
            {t('lp_badge')}
            <span className="lp-pulse-d" style={{ width: 5, height: 5, borderRadius: '50%', background: acc, display: 'inline-block' }} />
          </div>

          <h1 className="fade-up-1" style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 'clamp(2.8rem,7vw,5.5rem)', lineHeight: 1.02, letterSpacing: '-0.04em', marginBottom: 24, backgroundImage: `linear-gradient(150deg,#fff 0%,#fff 45%,${acc} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', maxWidth: 860, margin: '0 auto 24px' }}>
            {t('lp_hero_line1')}<br />
            {t('lp_hero_line2')}
          </h1>

          <p className="fade-up-2" style={{ fontSize: 'clamp(.88rem,2vw,1.05rem)', color: '#4a5568', maxWidth: 500, lineHeight: 1.8, marginBottom: 40 }}>
            {t('lp_hero_desc')}
          </p>

          <div className="fade-up-3" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 64 }}>
            <Link href="/register" style={{ padding: '14px 40px', background: `linear-gradient(135deg,${acc},${acc2})`, color: '#fff', fontWeight: 700, fontSize: '.88rem', letterSpacing: '.06em', textDecoration: 'none', borderRadius: 8, transition: 'transform .2s,box-shadow .2s', display: 'inline-block' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,212,255,.3)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
            >
              {t('lp_cta_free')}
            </Link>
            <Link href="/login" style={{ padding: '14px 40px', border: `1px solid ${border}`, color: '#666', fontSize: '.88rem', letterSpacing: '.06em', textDecoration: 'none', borderRadius: 8, transition: 'color .2s,border-color .2s', display: 'inline-block' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.25)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#666'; e.currentTarget.style.borderColor = border }}
            >
              {t('lp_have_account')}
            </Link>
          </div>

          <SignalMockup />

          <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: Math.max(0, 1 - scrollY / 200) }}>
            <span style={{ fontSize: '.58rem', color: '#2a3a4a', letterSpacing: '.16em' }}>{t('lp_scroll')}</span>
            <div className="lp-pulse" style={{ width: 1, height: 32, background: 'linear-gradient(#4a5568,transparent)' }} />
          </div>
        </section>

        <div ref={statsSection.ref} style={{ borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`, background: 'rgba(10,15,30,.5)', padding: '60px 40px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', maxWidth: 900, margin: '0 auto' }}>
            {STATS.map(({ target, suffix, label }, i) => (
              <div key={label} style={{ flex: '1 1 180px', textAlign: 'center', padding: 28, borderRight: i < 3 ? `1px solid ${border}` : 'none', opacity: statsSection.visible ? 1 : 0, transform: statsSection.visible ? 'translateY(0)' : 'translateY(20px)', transition: `opacity .6s ${i * 0.1}s, transform .6s ${i * 0.1}s` }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '2.8rem', fontWeight: 800, background: 'linear-gradient(135deg,#fff,#00d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', lineHeight: 1, marginBottom: 6 }}>
                  <Counter target={target} suffix={suffix} />
                </div>
                <div style={{ fontSize: '.65rem', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '.1em' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div id="section-features">
          <Divider num="01" label={t('lp_section_about')} />
        </div>
        <section style={{ padding: '120px 40px', maxWidth: 1140, margin: '0 auto' }}
          className={featuresSection.visible ? 'section-visible' : 'section-hidden'}
          ref={featuresSection.ref}
        >
          <div style={{ fontSize: '.65rem', color: '#00d4ff', letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 12 }}>{t('lp_features_badge')}</div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 'clamp(1.8rem,4vw,3rem)', color: '#fff', letterSpacing: '-0.03em', marginBottom: 48, lineHeight: 1.1 }}>
            {t('lp_features_title')}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 1, background: border }}>
            {FEATURES.map((f) => (
              <div key={f.title} className="glow-card"
                style={{ background: '#0a0a0a', padding: '40px 32px', borderTop: '2px solid transparent', transition: 'border-top-color .25s, transform .2s, background .2s', cursor: 'default', '--mx': '-9999px', '--my': '-9999px' } as React.CSSProperties}
                onMouseMove={e => {
                  const r = e.currentTarget.getBoundingClientRect()
                  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
                  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
                  e.currentTarget.style.borderTopColor = f.color
                  e.currentTarget.style.transform = 'translateY(-3px)'
                  e.currentTarget.style.background = '#111'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.setProperty('--mx', '-9999px')
                  e.currentTarget.style.setProperty('--my', '-9999px')
                  e.currentTarget.style.borderTopColor = 'transparent'
                  e.currentTarget.style.transform = ''
                  e.currentTarget.style.background = '#0a0a0a'
                }}
              >
                <div style={{ fontSize: '1.8rem', color: f.color, marginBottom: 16 }}>{f.icon}</div>
                <div style={{ fontSize: '.9rem', fontWeight: 600, color: '#e0e8f0', marginBottom: 10, letterSpacing: '.02em' }}>{f.title}</div>
                <div style={{ fontSize: '.75rem', color: '#4a5568', lineHeight: 1.8 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <div id="section-how">
          <Divider num="02" label={t('lp_section_how')} />
        </div>
        <section style={{ padding: '120px 40px', background: 'rgba(10,15,30,.15)' }}
          className={stepsSection.visible ? 'section-visible' : 'section-hidden'}
          ref={stepsSection.ref}
        >
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <div style={{ fontSize: '.65rem', color: '#00d4ff', letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 12 }}>{t('lp_steps_badge')}</div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 'clamp(1.8rem,4vw,3rem)', color: '#fff', letterSpacing: '-0.03em', marginBottom: 48, lineHeight: 1.1 }}>
              {t('lp_steps_title')}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {STEPS.map((s, i) => (
                <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 28, background: '#0a0a0a', padding: '44px 40px', borderLeft: `3px solid ${s.color}`, opacity: stepsSection.visible ? 1 : 0, transform: stepsSection.visible ? 'translateX(0)' : 'translateX(-20px)', transition: `opacity .5s ${i * 0.12}s, transform .5s ${i * 0.12}s` }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#111')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#0a0a0a')}
                >
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '2.4rem', fontWeight: 800, color: s.color, opacity: .35, flexShrink: 0, lineHeight: 1, minWidth: 50 }}>{s.n}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '.9rem', color: '#e0e8f0', fontWeight: 600, marginBottom: 8 }}>{s.title}</div>
                    <div style={{ fontSize: '.76rem', color: '#4a5568', lineHeight: 1.75 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div id="section-smc">
          <Divider num="03" label={t('lp_section_smc_label')} />
        </div>
        <section style={{ padding: '120px 40px', maxWidth: 1140, margin: '0 auto' }}
          className={smcSection.visible ? 'section-visible' : 'section-hidden'}
          ref={smcSection.ref}
        >
          <div style={{ fontSize: '.65rem', color: '#00d4ff', letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 12 }}>{t('lp_smc_badge')}</div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 'clamp(1.8rem,4vw,3rem)', color: '#fff', letterSpacing: '-0.03em', marginBottom: 16, lineHeight: 1.1 }}>
            {t('lp_smc_title')}
          </h2>
          <p style={{ fontSize: '.82rem', color: '#4a5568', maxWidth: 520, lineHeight: 1.9, marginBottom: 48 }}>
            {t('lp_smc_desc')}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 1, background: border }}>
            {SMC_ITEMS.map((s, i) => (
              <div key={s.tag} style={{ background: '#0a0a0a', padding: '36px 28px', position: 'relative', overflow: 'hidden', opacity: smcSection.visible ? 1 : 0, transform: smcSection.visible ? 'translateY(0)' : 'translateY(16px)', transition: `opacity .5s ${i * 0.1}s, transform .5s ${i * 0.1}s` }}
                onMouseEnter={e => { e.currentTarget.style.background = '#111'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#0a0a0a'; e.currentTarget.style.transform = smcSection.visible ? 'translateY(0)' : 'translateY(16px)' }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: s.color, opacity: .6 }} />
                <div style={{ fontSize: '.58rem', letterSpacing: '.2em', fontWeight: 700, color: s.color, marginBottom: 10 }}>{s.tag}</div>
                <div style={{ fontSize: '.82rem', color: '#c8d4e0', fontWeight: 600, marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: '.68rem', color: '#4a5568', lineHeight: 1.75 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <div id="section-pricing">
          <Divider num="04" label={t('lp_div4').split(' / ')[1] || 'PRICING'} />
        </div>
        <section style={{ padding: '120px 40px', background: 'rgba(10,15,30,.3)' }}
          ref={pricingSection.ref}
        >
          <div style={{ maxWidth: 1100, margin: '0 auto 48px' }}>
            <div style={{ fontSize: '.65rem', color: '#00d4ff', letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 12 }}>{t('lp_price_badge')}</div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 'clamp(1.8rem,4vw,3rem)', color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              {t('lp_price_title')}
            </h2>
          </div>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
            {PLANS.map((plan, i) => {
              const delay = `${i * 0.1}s`
              const cardStyle: React.CSSProperties = {
                opacity: pricingSection.visible ? 1 : 0,
                transform: pricingSection.visible ? 'translateY(0)' : 'translateY(24px)',
                transition: `opacity .5s ${delay}, transform .5s ${delay}`,
              }
              if (plan.popular) {
                return (
                  <div key={plan.name} className="pricing-popular-wrap" style={cardStyle}>
                    <div style={{ position: 'relative', zIndex: 1, background: '#0d1630', borderRadius: 12, padding: '28px 24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ fontSize: '.58rem', fontWeight: 700, letterSpacing: '.12em', background: 'linear-gradient(135deg,#00d4ff,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: 16, textTransform: 'uppercase' }}>{t('lp_popular_badge')}</div>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '1.3rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>{plan.name}</div>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '2.6rem', fontWeight: 800, color: '#fff', lineHeight: 1, marginBottom: 4 }}>{plan.price}<span style={{ fontSize: '1rem', color: '#4a5568', fontWeight: 400 }}>{plan.period}</span></div>
                      <div style={{ fontSize: '.72rem', color: '#4a5568', marginBottom: 24, lineHeight: 1.6 }}>{plan.desc}</div>
                      <div style={{ height: 1, background: border, marginBottom: 20 }} />
                      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28, flex: 1 }}>
                        {plan.features.map(f => <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '.76rem', color: '#8899aa', lineHeight: 1.4 }}><span style={{ color: '#00e676', fontWeight: 700, flexShrink: 0 }}>✓</span>{f}</li>)}
                      </ul>
                      <Link href="/register" style={{ width: '100%', padding: 11, borderRadius: 8, textAlign: 'center', textDecoration: 'none', display: 'block', fontSize: '.78rem', fontWeight: 700, letterSpacing: '.06em', background: 'linear-gradient(135deg,#00d4ff,#a855f7)', color: '#fff', boxShadow: '0 8px 24px rgba(0,212,255,.2)', transition: 'opacity .2s,box-shadow .2s,transform .2s' }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '.9'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,212,255,.35)' }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,212,255,.2)' }}
                      >{plan.btn}</Link>
                    </div>
                  </div>
                )
              }
              return (
                <div key={plan.name} style={{ background: '#0d0d0d', border: `1px solid ${border}`, borderRadius: 12, padding: '28px 24px', display: 'flex', flexDirection: 'column', transition: `opacity .5s ${delay}, transform .5s ${delay}, box-shadow .25s, border-color .25s`, ...cardStyle }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 24px 60px rgba(0,0,0,.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.15)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = pricingSection.visible ? 'translateY(0)' : 'translateY(24px)'; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = border }}
                >
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '1.3rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>{plan.name}</div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '2.6rem', fontWeight: 800, color: '#fff', lineHeight: 1, marginBottom: 4 }}>{plan.price}<span style={{ fontSize: '1rem', color: '#4a5568', fontWeight: 400 }}>{plan.period}</span></div>
                  <div style={{ fontSize: '.72rem', color: '#4a5568', marginBottom: 24, lineHeight: 1.6 }}>{plan.desc}</div>
                  <div style={{ height: 1, background: border, marginBottom: 20 }} />
                  <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28, flex: 1 }}>
                    {plan.features.map(f => <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '.76rem', color: '#8899aa', lineHeight: 1.4 }}><span style={{ color: '#00e676', fontWeight: 700, flexShrink: 0 }}>✓</span>{f}</li>)}
                    {plan.noFeatures.map(f => <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '.76rem', color: '#2a3a4a', lineHeight: 1.4 }}><span style={{ color: '#2a3a4a', fontWeight: 700, flexShrink: 0 }}>—</span>{f}</li>)}
                  </ul>
                  <Link href="/register" style={{ width: '100%', padding: 11, borderRadius: 8, textAlign: 'center', textDecoration: 'none', display: 'block', fontSize: '.78rem', fontWeight: 700, letterSpacing: '.06em', background: 'none', border: `1px solid ${border}`, color: '#4a5568', transition: 'color .2s,border-color .2s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.25)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#4a5568'; e.currentTarget.style.borderColor = border }}
                  >{i === 0 ? t('lp_p1_btn') : plan.btn}</Link>
                </div>
              )
            })}
          </div>
        </section>

        <section style={{ textAlign: 'center', padding: '160px 40px', position: 'relative', overflow: 'hidden' }}
          className={ctaSection.visible ? 'section-visible' : 'section-hidden'}
          ref={ctaSection.ref}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center,rgba(168,85,247,.08) 0%,rgba(0,212,255,.06) 50%,transparent 80%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: '.65rem', color: '#4a5568', letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 20 }}>{t('lp_cta_badge')}</div>
            <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 'clamp(2rem,5vw,4rem)', color: '#fff', letterSpacing: '-0.04em', marginBottom: 16, lineHeight: 1.05 }}>
              {t('lp_cta_title')}
            </h2>
            <p style={{ fontSize: '.88rem', color: '#4a5568', marginBottom: 40 }}>{t('lp_cta_desc')}</p>
            <Link href="/register" style={{ display: 'inline-block', padding: '16px 60px', background: 'linear-gradient(135deg,#00d4ff,#a855f7)', color: '#fff', fontSize: '.92rem', fontWeight: 700, borderRadius: 8, textDecoration: 'none', letterSpacing: '.08em', animation: 'cta-glow 3s ease infinite', transition: 'transform .2s,box-shadow .2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 20px 60px rgba(0,212,255,.4)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
            >
              {t('lp_cta_btn')}
            </Link>
            <div style={{ marginTop: 18 }}>
              <Link href="/login" style={{ fontSize: '.72rem', color: '#2a3a4a', textDecoration: 'none', transition: 'color .2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#8899aa')}
                onMouseLeave={e => (e.currentTarget.style.color = '#2a3a4a')}
              >{t('lp_cta_login')}</Link>
            </div>
          </div>
        </section>

        <footer style={{ borderTop: `1px solid ${border}`, background: 'rgba(8,8,8,.95)', padding: '80px 40px 48px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 40, marginBottom: 40 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <Logo size={22} />
              </div>
              <p style={{ fontSize: '.76rem', color: '#4a5568', lineHeight: 1.75, maxWidth: 260 }}>{t('lp_footer_desc')}</p>
            </div>
            <div>
              <h4 style={{ fontSize: '.7rem', color: '#2a3a4a', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 16 }}>{t('lp_footer_nav')}</h4>
              {[
                { href: '#section-features', label: t('lp_footer_about'), onClick: (e: React.MouseEvent) => { e.preventDefault(); scrollTo('section-features') } },
                { href: '#section-how', label: t('lp_footer_how'), onClick: (e: React.MouseEvent) => { e.preventDefault(); scrollTo('section-how') } },
                { href: '#section-pricing', label: t('lp_footer_pricing_link'), onClick: (e: React.MouseEvent) => { e.preventDefault(); scrollTo('section-pricing') } },
              ].map(({ href, label, onClick }) => (
                <a key={href} href={href} onClick={onClick} style={{ display: 'block', fontSize: '.8rem', color: '#4a5568', textDecoration: 'none', marginBottom: 10, transition: 'color .2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#4a5568')}
                >{label}</a>
              ))}
            </div>
            <div>
              <h4 style={{ fontSize: '.7rem', color: '#2a3a4a', letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 16 }}>{t('lp_footer_acc')}</h4>
              <Link href="/login" style={{ display: 'block', fontSize: '.8rem', color: '#4a5568', textDecoration: 'none', marginBottom: 10, transition: 'color .2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#4a5568')}
              >{t('lp_footer_signin')}</Link>
              <Link href="/register" style={{ display: 'block', fontSize: '.8rem', color: '#4a5568', textDecoration: 'none', marginBottom: 10, transition: 'color .2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#4a5568')}
              >{t('lp_footer_register')}</Link>
              <button onClick={() => setPrivacyOpen(true)} style={{ display: 'block', fontSize: '.8rem', color: '#4a5568', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: "'Geist Mono',monospace", transition: 'color .2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#4a5568')}
              >{t('lp_footer_privacy')}</button>
            </div>
          </div>
          <div style={{ maxWidth: 1100, margin: '0 auto', paddingTop: 24, borderTop: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.66rem', color: '#2a3a4a' }}>{t('lp_footer_rights')}</span>
            <span style={{ fontSize: '.66rem', color: '#1e2a3a' }}>kotvuk.asia</span>
          </div>
        </footer>
      </div>

      <div className={`lp-modal-overlay${privacyOpen ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setPrivacyOpen(false) }}>
        <div className="lp-modal-box">
          <div className="lp-modal-head">
            <h3>{t('lp_privacy_title')}</h3>
            <button className="lp-modal-close" onClick={() => setPrivacyOpen(false)}>✕</button>
          </div>
          <div className="lp-modal-body">
            <div className="lp-modal-date">{t('lp_privacy_date')}</div>
            <h4>1. Общие положения</h4>
            <p>Настоящая Политика конфиденциальности регулирует порядок сбора, хранения и использования персональных данных пользователей платформы KotvukAI (далее — «Сервис»). Используя Сервис, вы соглашаетесь с условиями данной Политики.</p>
            <h4>2. Собираемые данные</h4>
            <p>При регистрации и использовании Сервиса мы можем собирать следующие данные:</p>
            <ul>
              <li>Адрес электронной почты и имя пользователя (никнейм)</li>
              <li>Идентификатор Firebase UID для авторизации</li>
              <li>История торговых сигналов и аналитических запросов</li>
              <li>Telegram ID — при подключении уведомлений</li>
              <li>Технические данные: IP-адрес, тип браузера, временные метки запросов</li>
            </ul>
            <h4>3. Цели обработки данных</h4>
            <p>Собранные данные используются исключительно для идентификации пользователя, отправки сигналов в Telegram, подсчёта лимитов AI-анализов по тарифу, ведения торгового журнала и улучшения качества Сервиса.</p>
            <h4>4. Передача данных третьим лицам</h4>
            <p>Мы не продаём и не передаём ваши персональные данные третьим лицам. Сервис использует технических провайдеров исключительно для обеспечения работы платформы:</p>
            <ul>
              <li><strong style={{ color: '#c8d4e0' }}>Firebase (Google)</strong> — аутентификация и хранение профилей</li>
              <li><strong style={{ color: '#c8d4e0' }}>Neon Database</strong> — хранение сигналов, сделок и журнала</li>
              <li><strong style={{ color: '#c8d4e0' }}>AI Engine</strong> — обработка AI-запросов (данные не сохраняются)</li>
              <li><strong style={{ color: '#c8d4e0' }}>Binance API</strong> — получение рыночных данных (только чтение)</li>
              <li><strong style={{ color: '#c8d4e0' }}>Vercel</strong> — хостинг и доставка приложения</li>
            </ul>
            <h4>5. Хранение данных</h4>
            <p>Данные хранятся на серверах Neon Database (регион EU) и Firebase (серверы Google). Технические логи — не более 30 дней. Данные аккаунта — до удаления учётной записи.</p>
            <h4>6. Права пользователя</h4>
            <p>Вы вправе в любой момент запросить выгрузку своих данных, отозвать согласие на обработку или потребовать удаления аккаунта. Обратитесь по адресу: <a href="mailto:prostotak2025@gmail.com">prostotak2025@gmail.com</a></p>
            <h4>7. Безопасность</h4>
            <p>Доступ к аккаунту защищён через Firebase Authentication. Все запросы передаются по HTTPS. Пароли не хранятся в открытом виде.</p>
            <h4>8. Изменения политики</h4>
            <p>Мы оставляем за собой право вносить изменения в данную Политику. Продолжение использования Сервиса после обновления означает согласие с новой редакцией.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
