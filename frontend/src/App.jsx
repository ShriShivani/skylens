import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { MoodProvider, Sky } from './components/Sky.jsx';
import { PrefsProvider, usePrefs } from './components/prefs.jsx';
import Live from './pages/Live.jsx';
import Overview from './pages/Overview.jsx';
import Temperature from './pages/Temperature.jsx';
import Rainfall from './pages/Rainfall.jsx';
import Extremes from './pages/Extremes.jsx';
import Compare from './pages/Compare.jsx';
import Atmosphere from './pages/Atmosphere.jsx';
import Predict from './pages/Predict.jsx';
import MapView from './pages/MapView.jsx';
import Explorer from './pages/Explorer.jsx';
import Pipeline from './pages/Pipeline.jsx';

const LINKS = [
  ['/', '☀️', 'Live Weather', 'Realtime'],
  ['/map', '🗺️', 'Weather Map', 'Realtime'],
  ['/overview', '📊', 'Overview', 'Hadoop Analytics'],
  ['/temperature', '🌡️', 'Temperature'],
  ['/rainfall', '🌧️', 'Rainfall'],
  ['/atmosphere', '💨', 'Humidity & Wind'],
  ['/extremes', '⚡', 'Extreme Events'],
  ['/compare', '⚖️', 'Compare'],
  ['/predict', '🔮', 'Trends & Forecast'],
  ['/explorer', '🔎', 'Data Explorer', 'System'],
  ['/pipeline', '🐘', 'Pipeline & About'],
];

const Logo = () => (
  <svg className="logo" viewBox="0 0 64 64">
    <defs><linearGradient id="lg" x1="0" x2="1"><stop offset="0" stopColor="#38bdf8" /><stop offset="1" stopColor="#0ea5e9" /></linearGradient></defs>
    <circle cx="24" cy="24" r="13" fill="#fbbf24" />
    <path d="M18 48a11 11 0 010-22 15 15 0 0129 4 9 9 0 010 18z" fill="url(#lg)" />
  </svg>
);

function Shell() {
  const { unit, setUnit } = usePrefs();
  const loc = useLocation();
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('theme') || 'dusk'; } catch { return 'dusk'; } });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch {}
  }, [theme]);

  return (
    <MoodProvider>
      <Sky />
      <div className="shell">
        <nav className="nav">
          <div className="brand"><Logo /><div>Skylens<small>Weather × Hadoop</small></div></div>
          <LayoutGroup>
            {LINKS.map(([to, ic, label, section]) => (
              <span key={to} style={{ display: 'contents' }}>
                {section && <div className="sep">{section}</div>}
                <NavLink to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
                  {({ isActive }) => (<>{isActive && <motion.span layoutId="pill" className="pill" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}<span>{ic}</span>{label}</>)}
                </NavLink>
              </span>
            ))}
          </LayoutGroup>
          <div className="foot">
            <small style={{ color: 'var(--muted)' }}>v2.0</small>
            <button className="icon-btn" onClick={() => setUnit(unit === 'C' ? 'F' : 'C')} title="Switch °C / °F">°{unit}</button>
            <button className="icon-btn" onClick={() => setTheme(theme === 'dusk' ? 'day' : 'dusk')} title="Toggle theme">{theme === 'dusk' ? '🌙' : '☀️'}</button>
          </div>
        </nav>
        <main className="main">
          <AnimatePresence mode="wait">
            <motion.div key={loc.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              <Routes location={loc}>
                <Route path="/" element={<Live />} />
                <Route path="/map" element={<MapView />} />
                <Route path="/overview" element={<Overview />} />
                <Route path="/temperature" element={<Temperature />} />
                <Route path="/rainfall" element={<Rainfall />} />
                <Route path="/atmosphere" element={<Atmosphere />} />
                <Route path="/extremes" element={<Extremes />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/predict" element={<Predict />} />
                <Route path="/explorer" element={<Explorer />} />
                <Route path="/pipeline" element={<Pipeline />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </MoodProvider>
  );
}

export default function App() {
  return <PrefsProvider><Shell /></PrefsProvider>;
}
