import { useEffect, useState } from 'react';

const BASE = import.meta.env.VITE_API_URL || '';

export async function api(path) {
  const r = await fetch(`${BASE}/api${path}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

// Fetch hook: re-runs when `path` changes; pass null to skip.
export function useApi(path, every = 0) {
  const [tick, setTick] = useState(0);
  useEffect(() => { if (!every) return; const i = setInterval(() => setTick((n) => n + 1), every); return () => clearInterval(i); }, [every]);
  const [state, set] = useState({ data: null, error: null, loading: !!path });
  useEffect(() => {
    if (!path) return set({ data: null, error: null, loading: false });
    let live = true;
    set((s) => ({ ...s, loading: !s.data, error: null }));
    api(path).then((data) => live && set({ data, error: null, loading: false }))
      .catch((error) => live && set({ data: null, error: error.message, loading: false }));
    return () => { live = false; };
  }, [path, tick]);
  return state;
}

export const iconUrl = (code, big = true) => `https://openweathermap.org/img/wn/${code}${big ? '@2x' : ''}.png`;
export const title = (s) => s.charAt(0) + s.slice(1).toLowerCase();
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const PALETTE = ['#38bdf8', '#fbbf24', '#fb7185', '#34d399', '#a78bfa', '#f97316', '#22d3ee', '#e879f9'];

let stationCache = null;
export function useStations() {
  const [s, set] = useState(stationCache || []);
  useEffect(() => { if (!stationCache) api('/hadoop/stations').then((d) => set((stationCache = d))).catch(() => {}); }, []);
  return s;
}
