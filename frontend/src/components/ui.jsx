import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { title } from '../api';

export const fade = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
};

export function Page({ title: t, sub, actions, children }) {
  return (
    <motion.div initial="hidden" animate="show">
      <motion.div className="head" variants={fade}>
        <div><h1>{t}</h1>{sub && <p>{sub}</p>}</div>
        {actions}
      </motion.div>
      {children}
    </motion.div>
  );
}

export const Card = ({ title: t, children, i = 1, className = '', style }) => (
  <motion.div className={`card ${className}`} variants={fade} custom={i} style={style}>
    {t && <h3>{t}</h3>}
    {children}
  </motion.div>
);

export function CountUp({ to, decimals = 0, dur = 1100 }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const s = performance.now(), a = from.current, b = Number(to) || 0;
    let raf;
    const step = (n) => {
      const p = Math.min(1, (n - s) / dur), e = 1 - (1 - p) ** 3;
      setV(a + (b - a) * e);
      if (p < 1) raf = requestAnimationFrame(step); else from.current = b;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, dur]);
  return <>{v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}

export const Tile = ({ label, value, unit, decimals = 0, sub, i = 0 }) => (
  <motion.div className="card tile" variants={fade} custom={i}>
    <div className="l">{label}</div>
    <div className="v">{typeof value === 'number' ? <CountUp to={value} decimals={decimals} /> : value}{unit && <small>{unit}</small>}</div>
    {sub && <div className="s">{sub}</div>}
    <div className="bar" />
  </motion.div>
);

export const Loading = ({ n = 3 }) => (
  <div className="grid g3">{Array.from({ length: n }, (_, i) => <div key={i} className="skeleton" style={{ height: 160 }} />)}</div>
);
export const ErrorBox = ({ error }) => error ? <div className="err">⚠ {error}</div> : null;

export function Data({ state, children, skeleton }) {
  if (state.error) return <ErrorBox error={state.error} />;
  if (state.loading || !state.data) return skeleton || <Loading />;
  return children(state.data);
}

export function StationSelect({ stations, value, onChange, all }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {all && <option value="">All stations</option>}
      {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
}

export const Tip = ({ active, payload, label, unit = '' }) => active && payload?.length ? (
  <div className="tt">
    <b>{label}</b>
    {payload.map((p) => (
      <div key={p.dataKey}><span className="legend-dot" style={{ background: p.color || p.stroke }} />{p.name}: <b>{typeof p.value === 'number' ? +p.value.toFixed(2) : p.value}{unit}</b></div>
    ))}
  </div>
) : null;

export const nice = title;

export function downloadCsv(name, rows) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name; a.click();
}
