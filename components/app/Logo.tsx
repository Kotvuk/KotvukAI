const KOTVUK_DELAYS = [0, .04, .08, .12, .16, .2]
const AI_DELAYS = [.28, .34]

export default function Logo({ size = 20 }: { size?: number }) {
  const fontSize = `${(size / 20) * 0.9}rem`

  return (
    <div className="brand-logo">
      <svg className="bl-icon" viewBox="-4 -8 68 70" width={size} height={size}>
        <g strokeLinecap="round">
          <line x1="13" y1="26" x2="13" y2="58" className="bl-stem bl-stem1" strokeWidth="2" />
          <rect x="8" y="32" width="10" height="20" rx="2" className="bl-bar bl-bar1" />
          <line x1="29" y1="14" x2="29" y2="58" className="bl-stem bl-stem2" strokeWidth="2" />
          <rect x="24" y="20" width="10" height="32" rx="2" className="bl-bar bl-bar2" />
          <line x1="45" y1="2" x2="45" y2="58" className="bl-stem bl-stem3" strokeWidth="2" />
          <rect x="40" y="8" width="10" height="44" rx="2" className="bl-bar bl-bar3" />
        </g>
        <polyline points="13,26 29,14 45,2 58,-4" fill="none" className="bl-trend" strokeWidth="2" strokeDasharray="3 3" />
        <circle cx="58" cy="-4" r="0" className="bl-node" />
        <circle cx="58" cy="-4" r="3.5" fill="none" className="bl-pulse" strokeWidth="1.5" />
      </svg>
      <span className="brand-logo-text" style={{ fontSize }}>
        {'Kotvuk'.split('').map((ch, i) => (
          <span key={i} className="bl-ch" style={{ animationDelay: `${KOTVUK_DELAYS[i]}s` }}>{ch}</span>
        ))}
        <b>
          {'AI'.split('').map((ch, i) => (
            <span key={i} className="bl-ch bl-ch-accent" style={{ animationDelay: `${AI_DELAYS[i]}s` }}>{ch}</span>
          ))}
        </b>
      </span>
    </div>
  )
}
