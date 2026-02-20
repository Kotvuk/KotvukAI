import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from './LangContext';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
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
import OnChainPanel from './panels/OnChainPanel';
import AIChat from './panels/AIChat';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } }
};

const getStyles = (theme) => ({
  app: { display: 'flex', height: '100vh', background: theme.bg, color: theme.text, fontFamily: "'Inter', sans-serif", overflow: 'hidden' },
  sidebar: (open) => ({
    width: open ? 240 : 0, background: theme.sidebarBg, borderRight: '1px solid ' + theme.border,
    overflow: 'hidden', flexShrink: 0, display: 'flex', flexDirection: 'column',
    transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
  }),
  sidebarInner: { width: 240, padding: '1rem 0' },
  navItem: (active) => ({
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', cursor: 'pointer',
    background: active ? theme.accent + '26' : 'transparent', color: active ? theme.accent : theme.textSecondary,
    border: 'none', width: '100%', textAlign: 'left', fontSize: 14, fontFamily: "'Inter',sans-serif",
    borderLeft: active ? '3px solid ' + theme.accent : '3px solid transparent', transition: 'all 0.15s'
  }),
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: {
    display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px',
    borderBottom: '1px solid ' + theme.border, background: theme.sidebarBg, flexShrink: 0
  },
  burger: { background: 'none', border: 'none', color: theme.text, fontSize: 22, cursor: 'pointer', padding: 4 },
  content: { flex: 1, overflow: 'auto', padding: 20, position: 'relative' },
  logo: { fontSize: 16, fontWeight: 700, color: theme.text, letterSpacing: -0.5, flex: 1 },
  accent: { color: theme.accent },
  logoutBtn: {
    padding: '6px 16px', borderRadius: 8, border: '1px solid ' + theme.red + '4D',
    background: theme.redBg, color: theme.red, fontSize: 13, fontWeight: 500,
    cursor: 'pointer', fontFamily: "'Inter',sans-serif", transition: 'all 0.2s'
  },
  userInfo: { fontSize: 13, color: theme.textMuted, marginRight: 12 },
  loadingScreen: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh',
    background: theme.bg, color: theme.accent, fontSize: 18, fontFamily: "'Inter',sans-serif"
  },
});

export default function App() {
  const { t } = useLang();
  const { user, loading, logout } = useAuth();
  const { theme } = useTheme();
  const [panel, setPanel] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [authView, setAuthView] = useState(null);

  const styles = getStyles(theme);

  if (loading) {
    return (
      <motion.div style={styles.loadingScreen} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        ⏳ {t('loading')}
      </motion.div>
    );
  }

  if (!user) {
    if (authView === 'login') return <AuthPage initialTab="login" onBack={() => setAuthView(null)} />;
    if (authView === 'register') return <AuthPage initialTab="register" onBack={() => setAuthView(null)} />;
    return <LandingPage onLogin={() => setAuthView('login')} onRegister={() => setAuthView('register')} />;
  }

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
    { id: 'onchain', icon: '⛓️', labelKey: 'onChain' },
    { id: 'learning', icon: '📚', labelKey: 'learning' },
    { id: 'settings', icon: '⚙️', labelKey: 'settings' },
  ];

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
      case 'onchain': return <OnChainPanel />;
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
          <div style={{ padding: '8px 20px 20px', borderBottom: '1px solid ' + theme.border, marginBottom: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: theme.text }}>Kotvuk<span style={styles.accent}>AI</span></span>
          </div>
          {PANELS.map((p, i) => (
            <motion.button
              key={p.id}
              style={styles.navItem(panel === p.id)}
              onClick={() => setPanel(p.id)}
              whileHover={{ x: 4, background: panel === p.id ? theme.accent + '26' : theme.hoverBg }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02, duration: 0.2 }}
            >
              <span>{p.icon}</span><span>{t(p.labelKey)}</span>
            </motion.button>
          ))}
        </div>
      </div>
      <div style={styles.main}>
        <div style={styles.header}>
          <motion.button
            style={styles.burger}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            ☰
          </motion.button>
          <span style={styles.logo}>Kotvuk<span style={styles.accent}>AI</span> {t('aiAnalytics')}</span>
          <span style={styles.userInfo}>{user.name || user.email}</span>
          <motion.button
            style={styles.logoutBtn}
            onClick={logout}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {t('logout')}
          </motion.button>
        </div>
        <div style={styles.content}>
          <AnimatePresence mode="wait">
            <motion.div
              key={panel}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {renderPanel()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <AIChat />
    </div>
  );
}
