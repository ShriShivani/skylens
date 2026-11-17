import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

const MoodCtx = createContext({ mood: 'clear', setMood: () => {} });
export const useMood = () => useContext(MoodCtx);

// Map an OpenWeather payload to one of our sky moods.
export function moodFrom(w) {
  if (!w?.weather?.[0]) return 'clear';
  const m = w.weather[0].main, night = w.weather[0].icon?.endsWith('n');
  if (m === 'Thunderstorm') return 'thunder';
  if (['Rain', 'Drizzle'].includes(m)) return 'rain';
  if (m === 'Snow') return 'snow';
  if (['Clouds', 'Mist', 'Fog', 'Haze', 'Smoke', 'Dust'].includes(m)) return night ? 'night' : 'clouds';
  return night ? 'night' : 'clear';
}

export function MoodProvider({ children }) {
  const [mood, setMood] = useState('clear');
  useEffect(() => { document.documentElement.dataset.mood = mood; }, [mood]);
  const v = useMemo(() => ({ mood, setMood }), [mood]);
  return <MoodCtx.Provider value={v}>{children}</MoodCtx.Provider>;
}

export function Sky() {
  const ref = useRef(null);
  const { mood } = useMood();
  const moodRef = useRef(mood);
  moodRef.current = mood;

  useEffect(() => {
    const c = ref.current, g = c.getContext('2d');
    let w, h, raf, flash = 0;
    const resize = () => { w = c.width = innerWidth; h = c.height = innerHeight; };
    resize(); addEventListener('resize', resize);

    const drops = Array.from({ length: 180 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() }));
    const flakes = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random(), s: 0.3 + Math.random(), p: Math.random() * 6 }));
    const clouds = Array.from({ length: 7 }, (_, i) => ({ x: Math.random(), y: 0.05 + Math.random() * 0.4, s: 0.6 + Math.random() * 1.2, v: 0.00004 + Math.random() * 0.00008 }));
    const stars = Array.from({ length: 110 }, () => ({ x: Math.random(), y: Math.random() * 0.7, r: Math.random() * 1.4 + 0.2, p: Math.random() * 6 }));
    let t = 0;

    const cloud = (cx, cy, sc, a) => {
      g.fillStyle = `rgba(255,255,255,${a})`;
      [[0, 0, 46], [44, -14, 56], [92, 0, 44], [46, 12, 50]].forEach(([dx, dy, r]) => {
        g.beginPath(); g.arc(cx + dx * sc, cy + dy * sc, r * sc, 0, 7); g.fill();
      });
    };

    const frame = () => {
      t += 1; const m = moodRef.current;
      g.clearRect(0, 0, w, h);

      if (m === 'clear') { // sun glow with breathing rays
        const x = w * 0.82, y = h * 0.18, r = 90 + Math.sin(t / 50) * 6;
        const gr = g.createRadialGradient(x, y, 0, x, y, r * 4);
        gr.addColorStop(0, 'rgba(255,224,130,.95)'); gr.addColorStop(0.18, 'rgba(251,191,36,.55)'); gr.addColorStop(1, 'rgba(251,191,36,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.save(); g.translate(x, y); g.rotate(t / 600);
        for (let i = 0; i < 14; i++) { g.rotate(Math.PI / 7); g.fillStyle = 'rgba(255,235,160,.07)'; g.fillRect(r * 0.9, -6, r * 3.2, 12); }
        g.restore();
      }
      if (m === 'night' || m === 'thunder') {
        stars.forEach((s) => {
          g.fillStyle = `rgba(255,255,255,${m === 'night' ? 0.4 + 0.6 * Math.abs(Math.sin(t / 40 + s.p)) : 0.15})`;
          g.beginPath(); g.arc(s.x * w, s.y * h, s.r, 0, 7); g.fill();
        });
        if (m === 'night') { g.fillStyle = '#fef3c7'; g.beginPath(); g.arc(w * 0.84, h * 0.17, 34, 0, 7); g.fill();
          g.fillStyle = 'rgba(8,26,61,.95)'; g.beginPath(); g.arc(w * 0.84 + 14, h * 0.17 - 6, 30, 0, 7); g.fill(); }
      }
      if (['clouds', 'rain', 'thunder', 'snow', 'clear', 'night'].includes(m)) {
        const alpha = m === 'clear' ? 0.07 : m === 'night' ? 0.05 : m === 'clouds' ? 0.16 : 0.12;
        clouds.forEach((cl) => {
          cl.x += cl.v; if (cl.x > 1.25) cl.x = -0.3;
          cloud(cl.x * w, cl.y * h + Math.sin(t / 120 + cl.s) * 6, cl.s * (m === 'clear' ? 0.9 : 1.5), alpha);
        });
      }
      if (m === 'rain' || m === 'thunder') {
        g.strokeStyle = 'rgba(160,215,255,.5)'; g.lineWidth = 1.2; g.beginPath();
        drops.forEach((d) => {
          d.y += 0.02 * d.s * (m === 'thunder' ? 1.5 : 1); d.x -= 0.003 * d.s;
          if (d.y > 1) { d.y = -0.05; d.x = Math.random() * 1.1; }
          const px = d.x * w, py = d.y * h; g.moveTo(px, py); g.lineTo(px - 4 * d.s, py + 16 * d.s);
        });
        g.stroke();
      }
      if (m === 'thunder') {
        if (Math.random() < 0.004) flash = 1;
        if (flash > 0) { g.fillStyle = `rgba(210,200,255,${flash * 0.35})`; g.fillRect(0, 0, w, h); flash -= 0.06; }
      }
      if (m === 'snow') {
        g.fillStyle = 'rgba(255,255,255,.85)';
        flakes.forEach((f) => {
          f.y += 0.0022 * f.s; f.x += Math.sin(t / 60 + f.p) * 0.0006;
          if (f.y > 1) { f.y = -0.02; f.x = Math.random(); }
          g.beginPath(); g.arc(f.x * w, f.y * h, 1.4 + f.s * 2, 0, 7); g.fill();
        });
      }
      raf = requestAnimationFrame(frame);
    };
    frame();
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
  }, []);

  return (
    <>
      <canvas id="sky" ref={ref} />
      <div className="waves" aria-hidden>
        {['w2', 'w1', 'w3'].map((k) => (
          <svg key={k} className={k} viewBox="0 0 1440 160" preserveAspectRatio="none">
            <path d="M0 80 C 180 20, 360 140, 540 80 S 900 20, 1080 80 S 1260 140, 1440 80 L1440 160 L0 160Z M1440 80 C 1620 20, 1800 140, 1980 80 S 2340 20, 2520 80 S 2700 140, 2880 80 L2880 160 L1440 160Z" />
          </svg>
        ))}
      </div>
    </>
  );
}
