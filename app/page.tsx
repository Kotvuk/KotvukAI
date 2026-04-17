'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

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
    let start = 0
    const step = Math.ceil(target / 40)
    const id = setInterval(() => {
      start += step
      if (start >= target) { setVal(target); clearInterval(id) } else setVal(start)
    }, 30)
    return () => clearInterval(id)
  }, [visible, target])
  return <span ref={ref}>{val}{suffix}</span>
}

const TICKER_SYMS = [
  { sym: 'BTC', key: 'BTCUSDT' },
  { sym: 'ETH', key: 'ETHUSDT' },
  { sym: 'SOL', key: 'SOLUSDT' },
  { sym: 'BNB', key: 'BNBUSDT' },
  { sym: 'XRP', key: 'XRPUSDT' },
  { sym: 'AVAX',key: 'AVAXUSDT'},
  { sym: 'DOGE',key: 'DOGEUSDT'},
  { sym: 'LINK',key: 'LINKUSDT'},
]
type TickerMap = Record<string, { price: number; change: number }>

function useLiveTicker(): TickerMap {
  const [tickers, setTickers] = useState<TickerMap>({})
  useEffect(() => {
    fetch('/api/ticker')
      .then(r => r.json())
      .then(d => setTickers(d))
      .catch(() => {})
  }, [])
  return tickers
}

function MiniChart({ bullish }: { bullish: boolean }) {
  const c = bullish ? '#00e676' : '#ff3d57'
  const candles = bullish
    ? [[12,28,10,30],[20,22,18,26],[28,18,14,28],[36,12,10,20],[44,8, 6,16],[52,5, 3,12],[60,2, 1,8 ]]
    : [[12,8, 6,16],[20,12,10,20],[28,18,14,28],[36,22,18,26],[44,28,24,32],[52,32,28,36],[60,36,32,40]]
  return (
    <svg viewBox="0 0 80 48" style={{ width: '100%', height: '100%', display: 'block' }}>
      {candles.map(([x, o, c2, h], i) => (
        <g key={i}>
          <line x1={x} y1={2} x2={x} y2={46} stroke={c} strokeWidth={1} opacity={0.3} />
          <rect x={x - 3} y={Math.min(o, c2)} width={6} height={Math.max(1, Math.abs(o - c2))}
            fill={c} opacity={0.9} />
        </g>
      ))}
      <polyline points={candles.map(([x, o]) => `${x},${o}`).join(' ')}
        fill="none" stroke={c} strokeWidth={1.5} opacity={0.4} />
    </svg>
  )
}

const FEATURES = [
  { icon: '◈', title: 'SMC AI-анализ', desc: 'Единый pipeline: структура → зона → ликвидность → проверка Адвоката дьявола. Конфлюэнс 3+ факторов, R:R мин. 1:1.5 принудительно. Плечо динамическое 1-125×.', color: '#00d4ff' },
  { icon: '◉', title: 'Smart Money Concepts', desc: 'Авто-детект Order Blocks, Breaker Blocks, FVG, Liquidity Zones, BOS/COB. OTE-вход 62-79% в зону.', color: '#00e676' },
  { icon: '▦', title: 'Профессиональные графики', desc: '10 000+ свечей, 12 инструментов рисования, Fibonacci, Funding Rate, авто-трендлайны.', color: '#ffb300' },
  { icon: '◉', title: 'Мультитаймфреймный анализ', desc: 'Реальный HTF Bias с вышестоящего TF: 15M получает байэс с 4H, 1H — с дневного. Никакого самообмана.', color: '#ff6b6b' },
  { icon: '◇', title: 'Торговый журнал', desc: 'PnL, направление, тип ордера, Win/Loss разметка. Открыть сделку прямо из AI-анализа одной кнопкой.', color: '#a78bfa' },
  { icon: '◈', title: 'AI-ассистент в чате', desc: 'Спросите ИИ про зоны, попросите нарисовать OB/FVG на графике, получите ответ на русском за секунды.', color: '#34d399' },
]

const STEPS = [
  { n: '01', t: 'Выберите пару и таймфрейм', d: '60+ криптопар, 7 таймфреймов (1M–1D)', color: '#00d4ff' },
  { n: '02', t: 'Нажмите АНАЛИЗ', d: 'ИИ проводит 4-шаговый анализ: структура → зона → сигнал → Адвокат дьявола. Entry/TP/SL рисуются на графике автоматически', color: '#00e676' },
  { n: '03', t: 'Получите полный торговый план', d: 'Точка входа, TP, SL, R:R, конфлюэнс, условие инвалидации, размер позиции', color: '#ffb300' },
]

const SMC_ITEMS = [
  { tag: 'OB', title: 'Order Blocks', desc: 'Зоны накопления институционального объёма — места откуда крупные игроки двигают рынок', color: '#00d4ff' },
  { tag: 'FVG', title: 'Fair Value Gap', desc: 'Зоны дисбаланса цены — часто выступают поддержкой/сопротивлением', color: '#00e676' },
  { tag: 'LIQ', title: 'Liquidity', desc: 'Buy Side и Sell Side ликвидность — цели институционального движения', color: '#ffb300' },
  { tag: 'BOS', title: 'BOS / COB', desc: 'Break of Structure и Change of Character — определяют смену тренда', color: '#ff6b6b' },
]

const COMPARE_ROWS = [
  ['AI-анализ сигналов',        true,  false],
  ['SMC авто-детект',           true,  false],
  ['4-шаговый AI pipeline',     true,  false],
  ['Бесплатный план (3/день)',  true,  true ],
  ['Funding Rate',              true,  true ],
  ['Инструменты рисования',     true,  true ],
  ['50+ брокеров (live trade)', false,  true ],
  ['Pine Script',               false,  true ],
  ['Мобильное приложение',      false,  true ],
]

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

const NAV_SECTIONS = [
  { id: 'section-about',   label: 'О проекте' },
  { id: 'section-how',     label: 'Как работает' },
  { id: 'section-smc',     label: 'SMC-разметка' },
  { id: 'section-compare', label: 'Преимущества' },
]

export default function LandingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const heroRef = useRef<HTMLDivElement>(null)
  const [scrollY, setScrollY] = useState(0)
  const liveTickers = useLiveTicker()
  const featuresSection = useInView()
  const stepsSection = useInView()
  const smcSection = useInView()
  const compareSection = useInView()
  const ctaSection = useInView()

  useEffect(() => { if (user) router.replace('/dashboard') }, [user, router])

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

  return (
    <div style={{ background: '#080808', color: '#d0d0d0', fontFamily: "'Geist Mono', monospace", overflowX: 'hidden' }}>
      {}
      <div style={{ position:'fixed', inset:0, backgroundImage:'linear-gradient(#1a1a1a 1px,transparent 1px),linear-gradient(90deg,#1a1a1a 1px,transparent 1px)', backgroundSize:'40px 40px', opacity:.3, pointerEvents:'none', zIndex:0 }} />

      {}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:1, overflow:'hidden' }}>
        <div className="lp-scanline" />
      </div>

      <div style={{ position:'relative', zIndex:2 }}>
        {}
        <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 24px', height:56, borderBottom:'1px solid #1a1a1a', background:'rgba(8,8,8,.95)', backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:100, gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
            <div className="lp-glow" style={{ width:22, height:22, background:'#00d4ff', clipPath:'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' }} />
            <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'1rem', color:'#fff', letterSpacing:'-0.02em' }}>
              KOTVUK<span style={{ color:'#00d4ff' }}>AI</span>
            </span>
          </div>
          <div style={{ display:'flex', gap:4, flex:1, justifyContent:'center' }}>
            {NAV_SECTIONS.map(s => (
              <button key={s.id} onClick={() => scrollTo(s.id)}
                style={{ background:'none', border:'none', color:'#555', fontSize:'.65rem', letterSpacing:'.08em', cursor:'pointer', padding:'6px 14px', transition:'color .15s', fontFamily:"'Geist Mono',monospace" }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ccc')}
                onMouseLeave={e => (e.currentTarget.style.color = '#555')}
              >{s.label}</button>
            ))}
          </div>
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            <Link href="/login" className="nav-link" style={{ padding:'6px 18px', fontSize:'.7rem', letterSpacing:'.06em', border:'1px solid #2c2c2c', color:'#888', textDecoration:'none' }}>ВОЙТИ</Link>
            <Link href="/register" className="cta-btn" style={{ padding:'6px 18px', fontSize:'.7rem', letterSpacing:'.06em', background:'#00d4ff', color:'#080808', fontWeight:700, textDecoration:'none' }}>НАЧАТЬ →</Link>
          </div>
        </nav>

        {}
        <div style={{ borderBottom:'1px solid #1a1a1a', background:'#0a0a0a', overflow:'hidden', height:30, display:'flex', alignItems:'center' }}>
          <div className="lp-ticker">
            {[...TICKER_SYMS, ...TICKER_SYMS].map((t, i) => {
              const live = liveTickers[t.key]
              return (
                <span key={i} style={{ fontSize:'.6rem', display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ color:'#555' }}>{t.sym}/USDT</span>
                  <span style={{ color:'#888' }}>{live ? `$${live.price.toLocaleString(undefined, { maximumFractionDigits: live.price < 1 ? 5 : 2 })}` : '—'}</span>
                  {live && <span style={{ color: live.change >= 0 ? '#00e676' : '#ff3d57' }}>{live.change >= 0 ? '+' : ''}{live.change.toFixed(2)}%</span>}
                </span>
              )
            })}
          </div>
        </div>

        {}
        <section ref={heroRef} style={{ minHeight:'92vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'80px 32px 60px', position:'relative', overflow:'hidden' }}>
          {}
          <div style={{ position:'absolute', top:'20%', left:'50%', transform:'translateX(-50%)', width:600, height:400, background:'radial-gradient(ellipse,rgba(0,212,255,.06) 0%,transparent 70%)', pointerEvents:'none' }} />

          <div className="fade-up" style={{ fontSize:'.65rem', letterSpacing:'.2em', color:'#00d4ff', marginBottom:24, textTransform:'uppercase', display:'flex', alignItems:'center', gap:8 }}>
            <span className="lp-pulse" style={{ width:4, height:4, borderRadius:'50%', background:'#00d4ff', display:'inline-block' }} />
            AI-платформа для криптотрейдеров
            <span className="lp-pulse-d" style={{ width:4, height:4, borderRadius:'50%', background:'#00d4ff', display:'inline-block' }} />
          </div>

          <h1 className="fade-up-1" style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'clamp(2.4rem,7vw,5rem)', lineHeight:1.02, color:'#fff', letterSpacing:'-0.04em', margin:'0 auto 28px', maxWidth:860 }}>
            Анализируй крипту<br />
            <span style={{ color:'#00d4ff', textShadow:'0 0 60px rgba(0,212,255,.3)' }}>с помощью ИИ</span>
          </h1>

          <p className="fade-up-2" style={{ fontSize:'clamp(.8rem,2vw,.95rem)', color:'#555', maxWidth:520, margin:'0 auto 44px', lineHeight:1.8 }}>
            Автоматические сигналы LONG&nbsp;/&nbsp;SHORT, SMC-разметка, Fibonacci, торговый журнал.
            Анализ через Groq API — быстро, данные не передаются брокерам.
          </p>

          <div className="fade-up-3" style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap', marginBottom:64 }}>
            <Link href="/register" className="cta-btn" style={{ padding:'14px 40px', background:'#00d4ff', color:'#080808', fontWeight:700, fontSize:'.82rem', letterSpacing:'.08em', textDecoration:'none' }}>
              НАЧАТЬ БЕСПЛАТНО →
            </Link>
            <Link href="/login" style={{ padding:'14px 40px', border:'1px solid #2c2c2c', color:'#666', fontSize:'.82rem', letterSpacing:'.08em', textDecoration:'none', transition:'color .15s,border-color .15s' }}>
              У МЕНЯ ЕСТЬ АККАУНТ
            </Link>
          </div>

          {}
          <div className="fade-in lp-float" style={{ width:'100%', maxWidth:780, margin:'0 auto', background:'#0d0d0d', border:'1px solid #1a1a1a', borderRadius:2, overflow:'hidden' }}>
            {}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderBottom:'1px solid #1a1a1a', background:'#080808' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:'.65rem', color:'#fff', fontWeight:600 }}>BTC/USDT</span>
                <span style={{ fontSize:'.65rem', color:'#555' }}>·</span>
                <span style={{ fontSize:'.6rem', color:'#555' }}>1H</span>
                <span style={{ fontSize:'.65rem', color:'#00e676', fontWeight:600 }}>$84,312</span>
                <span style={{ fontSize:'.6rem', color:'#00e676' }}>+2.4%</span>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                {['LONG','TP: +2.5%','SL: -1.6%'].map((l, i) => (
                  <span key={l} style={{ padding:'2px 8px', fontSize:'.55rem', background: i===0?'rgba(0,230,118,.15)': i===1?'rgba(0,230,118,.1)':'rgba(255,61,87,.1)', color: i===0?'#00e676': i===1?'#00e676':'#ff3d57', border:`1px solid ${i===2?'rgba(255,61,87,.3)':'rgba(0,230,118,.3)'}` }}>{l}</span>
                ))}
              </div>
            </div>
            <div style={{ height:160, padding:'8px 16px', display:'flex', gap:2 }}>
              {Array.from({ length: 42 }, (_, i) => {

                const pct = Math.abs(Math.sin(i * 0.53 + 1.2) * 0.5 + Math.sin(i * 0.17) * 0.3) * 0.6 + 0.2
                const h = 20 + pct * 100
                const bull = Math.sin(i * 0.4 + 1) > 0
                return (
                  <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', alignItems:'center' }}>
                    <div style={{ width:'60%', height:Math.round(h * 0.7), background: bull ? 'rgba(0,230,118,.5)' : 'rgba(255,61,87,.5)', borderTop: `1px solid ${bull ? '#00e676' : '#ff3d57'}` }} />
                  </div>
                )
              })}
            </div>
            {}
            <div style={{ padding:'6px 16px 10px', display:'flex', gap:16, borderTop:'1px solid #111' }}>
              {[['Entry','#00d4ff','84,312'],['TP','#00e676','86,419'],['SL','#ff3d57','82,968']].map(([l, c, v]) => (
                <div key={l} style={{ display:'flex', alignItems:'center', gap:6, fontSize:'.58rem' }}>
                  <div style={{ width:16, height:1, background:c }} />
                  <span style={{ color:'#444' }}>{l}</span>
                  <span style={{ color: c }}>${v}</span>
                </div>
              ))}
              <div style={{ marginLeft:'auto', fontSize:'.55rem', color:'#333' }}>R:R 1:2.1 · Confidence 78%</div>
            </div>
          </div>

          {}
          <div style={{ position:'absolute', bottom:28, left:'50%', transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', gap:6, opacity: Math.max(0, 1 - scrollY / 200) }}>
            <span style={{ fontSize:'.55rem', color:'#333', letterSpacing:'.15em' }}>ЛИСТАЙТЕ ВНИЗ</span>
            <div className="lp-pulse" style={{ width:1, height:28, background:'linear-gradient(#333,transparent)' }} />
          </div>
        </section>

        {}
        <div style={{ borderTop:'1px solid #1a1a1a', borderBottom:'1px solid #1a1a1a', background:'#0a0a0a', padding:'40px 32px' }}>
          <div style={{ display:'flex', gap:0, justifyContent:'center', flexWrap:'wrap', maxWidth:800, margin:'0 auto' }}>
            {[
              { target:60, suffix:'+', label:'криптопар' },
              { target:7,  suffix:'',  label:'таймфреймов' },
              { target:4,  suffix:'',  label:'SMC-паттерна' },
              { target:12, suffix:'',  label:'инструментов рисования' },
            ].map(({ target, suffix, label }, i) => (
              <div key={label} style={{ flex:'1 1 160px', textAlign:'center', padding:'20px 16px', borderRight: i < 3 ? '1px solid #1a1a1a' : 'none' }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'2.4rem', fontWeight:800, color:'#fff', lineHeight:1, marginBottom:6 }}>
                  <Counter target={target} suffix={suffix} />
                </div>
                <div style={{ fontSize:'.58rem', color:'#444', textTransform:'uppercase', letterSpacing:'.1em' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div id="section-about" style={{ borderTop:'2px solid #1a1a1a', margin:'0 32px', display:'flex', alignItems:'center', gap:16 }}>
          <span style={{ fontSize:'.55rem', color:'#222', letterSpacing:'.2em', whiteSpace:'nowrap' }}>01 / О ПРОЕКТЕ</span>
          <div style={{ flex:1, height:1, background:'linear-gradient(90deg,#1a1a1a,transparent)' }} />
        </div>
        <section style={{ padding:'80px 32px', maxWidth:1100, margin:'0 auto' }}
          className={featuresSection.visible ? 'section-visible' : 'section-hidden'}
          ref={featuresSection.ref}
        >
          <div style={{ fontSize:'.6rem', color:'#00d4ff', letterSpacing:'.2em', textTransform:'uppercase', marginBottom:12 }}>ВОЗМОЖНОСТИ</div>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'clamp(1.6rem,3.5vw,2.4rem)', color:'#fff', marginBottom:52, letterSpacing:'-0.02em' }}>
            Всё для серьёзного трейдинга
          </h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:1, background:'#1a1a1a' }}>
            {FEATURES.map((f, i) => (
              <div key={f.title} className="feature-card"
                style={{ background:'#0d0d0d', padding:'28px 24px', borderTop:`2px solid transparent`, '--hover-color': f.color } as React.CSSProperties}
                onMouseEnter={e => (e.currentTarget.style.borderTopColor = f.color)}
                onMouseLeave={e => (e.currentTarget.style.borderTopColor = 'transparent')}
              >
                <div style={{ fontSize:'1.5rem', color:f.color, marginBottom:14, transition:'transform .2s' }}>{f.icon}</div>
                <div style={{ fontSize:'.8rem', fontWeight:600, color:'#e0e0e0', marginBottom:8, letterSpacing:'.02em' }}>{f.title}</div>
                <div style={{ fontSize:'.68rem', color:'#555', lineHeight:1.75 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <div id="section-how" style={{ borderTop:'2px solid #1a1a1a', margin:'0 32px', display:'flex', alignItems:'center', gap:16 }}>
          <span style={{ fontSize:'.55rem', color:'#222', letterSpacing:'.2em', whiteSpace:'nowrap' }}>02 / КАК РАБОТАЕТ</span>
          <div style={{ flex:1, height:1, background:'linear-gradient(90deg,#1a1a1a,transparent)' }} />
        </div>
        <section style={{ padding:'80px 32px', background:'#0a0a0a', borderBottom:'1px solid #1a1a1a' }}
          className={stepsSection.visible ? 'section-visible' : 'section-hidden'}
          ref={stepsSection.ref}
        >
          <div style={{ maxWidth:860, margin:'0 auto' }}>
            <div style={{ fontSize:'.6rem', color:'#00d4ff', letterSpacing:'.2em', textTransform:'uppercase', marginBottom:12 }}>КАК ЭТО РАБОТАЕТ</div>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'clamp(1.6rem,3.5vw,2.4rem)', color:'#fff', marginBottom:52, letterSpacing:'-0.02em' }}>
              4 шага до торгового плана
            </h2>
            <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
              {STEPS.map((s, i) => (
                <div key={s.n} style={{ display:'flex', alignItems:'flex-start', gap:28, background:'#0d0d0d', padding:'28px 32px', borderLeft:`3px solid ${s.color}` }}>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:'2rem', fontWeight:800, color:s.color, opacity:.45, flexShrink:0, lineHeight:1, minWidth:42 }}>{s.n}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'.82rem', color:'#e0e0e0', fontWeight:600, marginBottom:6 }}>{s.t}</div>
                    <div style={{ fontSize:'.68rem', color:'#555' }}>{s.d}</div>
                  </div>
                  <div style={{ width:48, height:48, flexShrink:0, opacity:.6 }}>
                    <MiniChart bullish={i < 2} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div id="section-smc" style={{ borderTop:'2px solid #1a1a1a', margin:'0 32px', display:'flex', alignItems:'center', gap:16 }}>
          <span style={{ fontSize:'.55rem', color:'#222', letterSpacing:'.2em', whiteSpace:'nowrap' }}>03 / SMC-РАЗМЕТКА</span>
          <div style={{ flex:1, height:1, background:'linear-gradient(90deg,#1a1a1a,transparent)' }} />
        </div>
        <section style={{ padding:'80px 32px', maxWidth:1100, margin:'0 auto' }}
          className={smcSection.visible ? 'section-visible' : 'section-hidden'}
          ref={smcSection.ref}
        >
          <div style={{ fontSize:'.6rem', color:'#00d4ff', letterSpacing:'.2em', textTransform:'uppercase', marginBottom:12 }}>SMART MONEY CONCEPTS</div>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'clamp(1.6rem,3.5vw,2.4rem)', color:'#fff', marginBottom:16, letterSpacing:'-0.02em' }}>
            Автоматическая SMC-разметка
          </h2>
          <p style={{ fontSize:'.75rem', color:'#444', lineHeight:1.9, marginBottom:48, maxWidth:560 }}>
            Нажмите кнопку SMC — и все паттерны появятся на графике за секунды.
            Без ручной разметки, без Premium-подписки.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:1, background:'#1a1a1a' }}>
            {SMC_ITEMS.map(s => (
              <div key={s.tag} style={{ background:'#0d0d0d', padding:'24px 22px', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:s.color, opacity:.5 }} />
                <div style={{ fontSize:'.55rem', color:s.color, letterSpacing:'.2em', marginBottom:8, fontWeight:600 }}>{s.tag}</div>
                <div style={{ fontSize:'.75rem', color:'#c0c0c0', fontWeight:600, marginBottom:8 }}>{s.title}</div>
                <div style={{ fontSize:'.62rem', color:'#444', lineHeight:1.7 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <div id="section-compare" style={{ borderTop:'2px solid #1a1a1a', margin:'0 32px', display:'flex', alignItems:'center', gap:16 }}>
          <span style={{ fontSize:'.55rem', color:'#222', letterSpacing:'.2em', whiteSpace:'nowrap' }}>04 / ПРЕИМУЩЕСТВА</span>
          <div style={{ flex:1, height:1, background:'linear-gradient(90deg,#1a1a1a,transparent)' }} />
        </div>
        <section style={{ padding:'80px 32px', background:'#0a0a0a', borderBottom:'1px solid #1a1a1a' }}
          className={compareSection.visible ? 'section-visible' : 'section-hidden'}
          ref={compareSection.ref}
        >
          <div style={{ maxWidth:700, margin:'0 auto' }}>
            <div style={{ fontSize:'.6rem', color:'#00d4ff', letterSpacing:'.2em', textTransform:'uppercase', marginBottom:12 }}>СРАВНЕНИЕ</div>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'clamp(1.6rem,3.5vw,2.4rem)', color:'#fff', marginBottom:48, letterSpacing:'-0.02em' }}>
              KotvukAI vs TradingView
            </h2>
            <div style={{ border:'1px solid #1a1a1a', overflow:'hidden' }}>
              {}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 140px 140px', background:'#0d0d0d', borderBottom:'1px solid #222' }}>
                <div style={{ padding:'12px 16px', fontSize:'.6rem', color:'#444', letterSpacing:'.1em' }}>ФУНКЦИЯ</div>
                <div style={{ padding:'12px 16px', fontSize:'.6rem', color:'#00d4ff', letterSpacing:'.1em', textAlign:'center' }}>KOTVUKAI</div>
                <div style={{ padding:'12px 16px', fontSize:'.6rem', color:'#555', letterSpacing:'.1em', textAlign:'center' }}>TRADINGVIEW</div>
              </div>
              {COMPARE_ROWS.map(([label, ours, theirs], i) => (
                <div key={String(label)} className="compare-row" style={{ display:'grid', gridTemplateColumns:'1fr 140px 140px', borderBottom: i < COMPARE_ROWS.length-1 ? '1px solid #111' : 'none', background: i%2===0 ? '#080808' : '#0a0a0a' }}>
                  <div style={{ padding:'11px 16px', fontSize:'.68rem', color:'#888' }}>{label}</div>
                  <div style={{ padding:'11px 16px', textAlign:'center', fontSize:'.8rem', color: ours ? '#00e676' : '#333' }}>{ours ? '✓' : '—'}</div>
                  <div style={{ padding:'11px 16px', textAlign:'center', fontSize:'.8rem', color: theirs ? '#00e676' : '#333' }}>{theirs ? '✓' : '—'}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:16, fontSize:'.6rem', color:'#333', textAlign:'right' }}>
              * KotvukAI бесплатен. TradingView от $14.95/мес.
            </div>
          </div>
        </section>

        {}
        <section style={{ textAlign:'center', padding:'120px 32px' }}
          className={ctaSection.visible ? 'section-visible' : 'section-hidden'}
          ref={ctaSection.ref}
        >
          <div style={{ fontSize:'.6rem', color:'#333', letterSpacing:'.2em', textTransform:'uppercase', marginBottom:16 }}>БЕСПЛАТНЫЙ ПЛАН · 3 АНАЛИЗА В ДЕНЬ · GROQ API</div>
          <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'clamp(2rem,5vw,3.5rem)', color:'#fff', letterSpacing:'-0.03em', marginBottom:16 }}>
            Готов торговать умнее?
          </h2>
          <p style={{ fontSize:'.75rem', color:'#444', marginBottom:44 }}>SMC-анализ, OTE-входы, реальный HTF Bias. Работает на Groq moonshotai/kimi-k2.</p>
          <Link href="/register" className="cta-btn" style={{ padding:'16px 56px', background:'#00d4ff', color:'#080808', fontWeight:700, fontSize:'.88rem', letterSpacing:'.1em', textDecoration:'none', display:'inline-block', boxShadow:'0 0 40px rgba(0,212,255,.2)' }}>
            СОЗДАТЬ АККАУНТ →
          </Link>
          <div style={{ marginTop:20 }}>
            <Link href="/login" style={{ fontSize:'.65rem', color:'#333', textDecoration:'none' }}>Уже есть аккаунт? Войти →</Link>
          </div>
        </section>

        {}
        <footer style={{ borderTop:'1px solid #1a1a1a', padding:'28px 32px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16, background:'#080808' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:16, height:16, background:'#00d4ff', clipPath:'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' }} />
            <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'.82rem', color:'#fff' }}>KotvukAI</span>
          </div>
          <div style={{ display:'flex', gap:24, fontSize:'.62rem' }}>
            <Link href="/privacy" style={{ color:'#333', textDecoration:'none' }}>Конфиденциальность</Link>
            <Link href="/login"   style={{ color:'#333', textDecoration:'none' }}>Войти</Link>
            <Link href="/register" style={{ color:'#333', textDecoration:'none' }}>Регистрация</Link>
          </div>
          <div style={{ fontSize:'.58rem', color:'#2a2a2a' }}>© 2026 KotvukAI. Все права защищены.</div>
        </footer>
      </div>
    </div>
  )
}
