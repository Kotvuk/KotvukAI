import React, { useState } from 'react';
import { useLang } from './LangContext';
import { useAuth } from './AuthContext';
import LandingPage from './LandingPage';
import AuthPage from './AuthPage';
import DashboardPanel from './panels/DashboardPanel';
import ChartsPanel from './panels/ChartsPanel';
import AIPanel from './panels/AIPanel';
import TradesPanel from './panels/TradesPanel';
import CalculatorPanel from './panels/CalculatorPanel';
import WhalePanel from './panels/WhalePanel';
import AlertsPanel from './panels/AlertsPanel';
import NewsPanel from './panels/NewsPanel';
import WatchlistPanel from './panels/WatchlistPanel';
import LearningPanel from './panels/LearningPanel';
import SettingsPanel from './panels/SettingsPanel';
import HeatmapPanel from './panels/HeatmapPanel';
import ScreenerPanel from './panels/ScreenerPanel';
import AdminPanel from './panels/AdminPanel';
import AIChat from './panels/AIChat';

const styles = {
  app: { display: 'flex', height: '100vh', background: '#0a0a0f', color: '#e0e0e0', fontFamily: "'Inter', sans-serif", overflow: 'hidden' },
  sidebar: (open) => ({
    width: open ? 240 : 0, background: '#0d0d14', borderRight: '1px solid rgba(255,255,255,0.06)',
    transition: 'width 0.25s', overflow: 'hidden', flexShrink: 0, display: 'flex', flexDirection: 'column'
  }),
  sidebarInner: { width: 240, padding: '1rem 0' },
  navItem: (active) => ({
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', cursor: 'pointer',
    background: active ? 'rgba(59,130,246,0.15)' : 'transparent', color: active ? '#3b82f6' : '#a0a0b0',
    border: 'none', width: '100%', textAlign: 'left', fontSize: 14, fontFamily: "'Inter',sans-serif",
    borderLeft: active ? '3px solid #3b82f6' : '3px solid transparent', transition: 'all 0.15s'
  }),
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: {
    display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0d0d14', flexShrink: 0
  },
  burger: { background: 'none', border: 'none', color: '#e0e0e0', fontSize: 22, cursor: 'pointer', padding: 4 },
  content: { flex: 1, overflow: 'auto', padding: 20 },
  logo: { fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: -0.5, flex: 1 },
  accent: { color: '#3b82f6' },
  logoutBtn: {
    padding: '6px 16px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)',
    background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', fontFamily: "'Inter',sans-serif", transition: 'all 0.2s'
  },
  userInfo: { fontSize: 13, color: '#808090', marginRight: 12 },
  loadingScreen: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh',
    background: '#0a0a0f', color: '#3b82f6', fontSize: 18, fontFamily: "'Inter',sans-serif"
  },
};

export default function App() {
  const { t } = useLang();
  const { user, loading, logout } = useAuth();
  const [panel, setPanel] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [authView, setAuthView] = useState(null); // null = landing, 'login', 'register'

  if (loading) {
    return <div style={styles.loadingScreen}>⏳ {t('loading')}</div>;
  }

  // Not authenticated: show landing or auth
  if (!user) {
    if (authView === 'login') {
      return <AuthPage initialTab="login" onBack={() => setAuthView(null)} />;
    }
    if (authView === 'register') {
      return <AuthPage initialTab="register" onBack={() => setAuthView(null)} />;
    }
    return <LandingPage onLogin={() => setAuthView('login')} onRegister={() => setAuthView('register')} />;
  }

  // Authenticated: show app
  const basePanels = [
    { id: 'dashboard', icon: '🏠', labelKey: 'dashboard' },
    { id: 'charts', icon: '📊', labelKey: 'charts' },
    { id: 'ai', icon: '🤖', labelKey: 'aiAnalytics' },
    { id: 'trades', icon: '📋', labelKey: 'trades' },
    { id: 'calc', icon: '🧮', labelKey: 'calculator' },
    { id: 'whale', icon: '🐋', labelKey: 'whaleAnalysis' },
    { id: 'alerts', icon: '🔔', labelKey: 'alerts' },
    { id: 'news', icon: '📰', labelKey: 'news' },
    { id: 'watchlist', icon: '🏆', labelKey: 'watchlist' },
    { id: 'heatmap', icon: '🗺️', labelKey: 'heatmap' },
    { id: 'screener', icon: '🔍', labelKey: 'screener' },
    { id: 'learning', icon: '📚', labelKey: 'learning' },
    { id: 'settings', icon: '⚙️', labelKey: 'settings' },
  ];

  // Add admin panel if user is admin
  const PANELS = user?.is_admin 
    ? [...basePanels.slice(0, -1), { id: 'admin', icon: '🛡️', labelKey: 'adminPanel' }, basePanels[basePanels.length - 1]]
    : basePanels;

  const renderPanel = () => {
    switch (panel) {
      case 'dashboard': return <DashboardPanel />;
      case 'charts': return <ChartsPanel />;
      case 'ai': return <AIPanel />;
      case 'trades': return <TradesPanel />;
      case 'calc': return <CalculatorPanel />;
      case 'whale': return <WhalePanel />;
      case 'alerts': return <AlertsPanel />;
      case 'news': return <NewsPanel />;
      case 'watchlist': return <WatchlistPanel />;
      case 'heatmap': return <HeatmapPanel />;
      case 'screener': return <ScreenerPanel />;
      case 'learning': return <LearningPanel />;
      case 'settings': return <SettingsPanel />;
      case 'admin': return <AdminPanel />;
      default: return <DashboardPanel />;
    }
  };

  return (
    <div style={styles.app}>
      <div style={styles.sidebar(sidebarOpen)}>
        <div style={styles.sidebarInner}>
          <div style={{ padding: '8px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Kotvuk<span style={styles.accent}>AI</span></span>
          </div>
          {PANELS.map(p => (
            <button key={p.id} style={styles.navItem(panel === p.id)} onClick={() => setPanel(p.id)}>
              <span>{p.icon}</span><span>{t(p.labelKey)}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={styles.main}>
        <div style={styles.header}>
          <button style={styles.burger} onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <span style={styles.logo}>Kotvuk<span style={styles.accent}>AI</span> {t('aiAnalytics')}</span>
          <span style={styles.userInfo}>{user.name || user.email}</span>
          <button style={styles.logoutBtn} onClick={logout}>{t('logout')}</button>
        </div>
        <div style={styles.content}>{renderPanel()}</div>
      </div>
      <AIChat />
    </div>
  );
}
