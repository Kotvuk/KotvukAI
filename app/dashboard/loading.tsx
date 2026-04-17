export default function DashboardLoading() {
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#080808', gap: 16,
      fontFamily: "'Geist Mono', monospace",
    }}>
      <div style={{ width: 22, height: 22, background: '#00d4ff', clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' }} />
      <div style={{ width: 140, height: 2, background: '#111', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '-40%', width: '40%', height: '100%', background: 'linear-gradient(90deg, transparent, #00d4ff, transparent)', animation: 'loading-bar 1.2s ease infinite' }} />
      </div>
      <style>{`@keyframes loading-bar { 0%{left:-40%} 100%{left:140%} }`}</style>
      <div style={{ fontSize: '.6rem', color: '#333', letterSpacing: '.1em' }}>ЗАГРУЗКА...</div>
    </div>
  )
}
