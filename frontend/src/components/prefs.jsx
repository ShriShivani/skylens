import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const Ctx = createContext(null);
export const usePrefs = () => useContext(Ctx);

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export function PrefsProvider({ children }) {
  const [unit, setUnit] = useState(() => read('unit', 'C'));
  const [favs, setFavs] = useState(() => read('favs', []));
  useEffect(() => write('unit', unit), [unit]);
  useEffect(() => write('favs', favs), [favs]);

  const t = useCallback((c, d = 0) => (c == null ? '–' : (unit === 'C' ? c : c * 9 / 5 + 32).toFixed(d)), [unit]);
  const toggleFav = useCallback((f) => setFavs((l) => (l.some((x) => x.key === f.key) ? l.filter((x) => x.key !== f.key) : [...l, f])), []);
  const v = useMemo(() => ({ unit, setUnit, t, deg: `°${unit}`, favs, toggleFav }), [unit, t, favs, toggleFav]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const [th, set] = useState(document.documentElement.dataset.theme || 'dusk');
  useEffect(() => {
    const o = new MutationObserver(() => set(document.documentElement.dataset.theme || 'dusk'));
    o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => o.disconnect();
  }, []);
  return th;
}
