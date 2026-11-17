import { useState } from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MONTHS, title, useApi, useStations } from '../api';
import { Card, Data, Page, StationSelect, Tile, Tip } from '../components/ui.jsx';

const METRICS = {
  avg_humidity: { label: 'Avg humidity', unit: '%', lo: 30, hi: 95, hue: 195 },
  avg_wind: { label: 'Avg wind', unit: ' km/h', lo: 6, hi: 22, hue: 40 },
  max_wind: { label: 'Peak gust', unit: ' km/h', lo: 20, hi: 120, hue: 350 },
};

export default function Atmosphere() {
  const stations = useStations();
  const [st, setSt] = useState('MUMBAI');
  const [metric, setMetric] = useState('avg_humidity');
  const res = useApi(`/hadoop/atmosphere?station=${st}`);
  const clim = useApi(`/hadoop/climatology?station=${st}`);
  const M = METRICS[metric];

  return (
    <Page title="Humidity & Wind" sub="MapReduce Job 4 · key = STATION-YYYY-MM · reducer emits mean/min/max humidity and mean/peak wind for each month."
      actions={<div className="controls"><StationSelect stations={stations} value={st} onChange={setSt} /></div>}>
      <Data state={res}>{(d) => {
        const mean = (k) => d.reduce((a, x) => a + x[k], 0) / d.length;
        const gust = d.reduce((a, x) => (x.max_wind > a.max_wind ? x : a));
        const humid = d.reduce((a, x) => (x.avg_humidity > a.avg_humidity ? x : a));
        const grid = Object.fromEntries(d.map((r) => [`${r.year}-${r.month}`, r]));
        const yearly = Object.values(d.reduce((a, r) => {
          const o = (a[r.year] ||= { year: r.year, h: 0, w: 0, n: 0 }); o.h += r.avg_humidity; o.w += r.avg_wind; o.n++; return a;
        }, {})).map((o) => ({ year: o.year, humidity: +(o.h / o.n).toFixed(1), wind: +(o.w / o.n).toFixed(1) }));
        const cell = (v) => { const t = Math.max(0, Math.min(1, (v - M.lo) / (M.hi - M.lo))); return `hsla(${M.hue}, 90%, ${68 - t * 28}%, ${0.15 + t * 0.85})`; };
        return (
          <>
            <div className="tiles">
              <Tile i={0} label="Mean humidity" value={mean('avg_humidity')} decimals={1} unit="%" sub={`${MONTHS[humid.month - 1]} ${humid.year} most humid`} />
              <Tile i={1} label="Mean wind speed" value={mean('avg_wind')} decimals={1} unit="km/h" />
              <Tile i={2} label="Peak gust" value={gust.max_wind} decimals={1} unit="km/h" sub={`${MONTHS[gust.month - 1]} ${gust.year}`} />
              <Tile i={3} label="Driest air month" value={Math.min(...d.map((x) => x.min_humidity))} decimals={1} unit="%" sub="lowest daily humidity" />
            </div>
            <div className="grid g2">
              <Card title={`${title(st)} · seasonal pattern`} i={1}>
                <Data state={clim} skeleton={<div className="skeleton" style={{ height: 300 }} />}>{(c) => (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={c.map((x) => ({ ...x, m: MONTHS[x.month - 1] }))}>
                      <defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#38bdf8" stopOpacity={0.5} /><stop offset="1" stopColor="#38bdf8" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid stroke="var(--grid)" vertical={false} />
                      <XAxis dataKey="m" stroke="var(--muted)" fontSize={11} />
                      <YAxis yAxisId="l" stroke="var(--sky)" fontSize={11} unit="%" domain={[0, 100]} />
                      <YAxis yAxisId="r" orientation="right" stroke="var(--sun)" fontSize={11} />
                      <Tooltip content={<Tip />} /><Legend />
                      <Area yAxisId="l" dataKey="avgHumidity" name="Humidity %" stroke="#38bdf8" strokeWidth={3} fill="url(#hg)" />
                      <Bar yAxisId="r" dataKey="avgWind" name="Avg wind km/h" fill="#fbbf24" opacity={0.7} radius={[6, 6, 0, 0]} />
                      <Line yAxisId="r" dataKey="peakGust" name="Peak gust km/h" stroke="#fb7185" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}</Data>
              </Card>
              <Card title="Year-by-year averages" i={2}>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={yearly}>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="year" stroke="var(--muted)" fontSize={11} />
                    <YAxis yAxisId="l" stroke="var(--sky)" fontSize={11} domain={['auto', 'auto']} unit="%" />
                    <YAxis yAxisId="r" orientation="right" stroke="var(--sun)" fontSize={11} domain={['auto', 'auto']} />
                    <Tooltip content={<Tip />} /><Legend />
                    <Line yAxisId="l" dataKey="humidity" name="Humidity %" stroke="#38bdf8" strokeWidth={3} dot={{ r: 3 }} />
                    <Line yAxisId="r" dataKey="wind" name="Wind km/h" stroke="#fbbf24" strokeWidth={3} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>
            </div>
            <div style={{ height: 18 }} />
            <Card title={`${title(st)} · heatmap (year × month)`} i={3}>
              <div className="chips" style={{ marginBottom: 12 }}>
                {Object.entries(METRICS).map(([k, v]) => <button key={k} className={`chip ${metric === k ? 'on' : ''}`} onClick={() => setMetric(k)}>{v.label}</button>)}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(12, minmax(46px, 1fr))', gap: 4, minWidth: 700 }}>
                  <span />{MONTHS.map((m) => <small key={m} style={{ textAlign: 'center', color: 'var(--muted)' }}>{m}</small>)}
                  {Array.from({ length: 15 }, (_, i) => 2010 + i).map((y) => (
                    <div key={y} style={{ display: 'contents' }}>
                      <small style={{ color: 'var(--muted)', alignSelf: 'center' }}>{y}</small>
                      {MONTHS.map((_, mi) => {
                        const c = grid[`${y}-${mi + 1}`];
                        return <div key={mi} title={c ? `${MONTHS[mi]} ${y}: humidity ${c.avg_humidity}%, wind ${c.avg_wind} km/h, gust ${c.max_wind} km/h` : ''}
                          style={{ height: 26, borderRadius: 7, background: c ? cell(c[metric]) : 'transparent', display: 'grid', placeItems: 'center', fontSize: 10, color: 'var(--ink)' }}>{c ? Math.round(c[metric]) : ''}</div>;
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </>
        );
      }}</Data>
    </Page>
  );
}
