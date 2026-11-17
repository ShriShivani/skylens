import { useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MONTHS, title, useApi, useStations } from '../api';
import { Card, Data, Page, StationSelect, Tile, Tip } from '../components/ui.jsx';

export default function Rainfall() {
  const stations = useStations();
  const [st, setSt] = useState('MUMBAI');
  const [year, setYear] = useState('');
  const res = useApi(`/hadoop/rainfall?station=${st}`);
  const clim = useApi(`/hadoop/climatology?station=${st}`);

  return (
    <Page title="Rainfall Analysis" sub="MapReduce Job 2 · key = STATION-YYYY-MM · reducer sums rainfall and counts days with rain > 0."
      actions={<div className="controls"><StationSelect stations={stations} value={st} onChange={setSt} />
        <select value={year} onChange={(e) => setYear(e.target.value)}><option value="">All years</option>{Array.from({ length: 15 }, (_, i) => 2010 + i).map((y) => <option key={y}>{y}</option>)}</select></div>}>
      <Data state={res}>{(d) => {
        const rows = year ? d.filter((r) => r.year === +year) : d;
        const total = rows.reduce((a, r) => a + r.total_rainfall_mm, 0);
        const rainy = rows.reduce((a, r) => a + r.rainy_days, 0);
        const peak = rows.reduce((a, r) => (r.total_rainfall_mm > a.total_rainfall_mm ? r : a), rows[0]);
        const maxCell = Math.max(...d.map((r) => r.total_rainfall_mm));
        const grid = {};
        d.forEach((r) => { grid[`${r.year}-${r.month}`] = r; });
        return (
          <>
            <div className="tiles">
              <Tile i={0} label="Total rainfall" value={total} unit="mm" />
              <Tile i={1} label="Rainy days" value={rainy} sub={`${((rainy / rows.reduce((a, r) => a + r.observations, 0)) * 100).toFixed(0)}% of days`} />
              <Tile i={2} label="Wettest month" value={`${MONTHS[peak.month - 1]} ${peak.year}`} sub={`${peak.total_rainfall_mm} mm`} />
            </div>
            <div className="grid g2">
              <Card title="Seasonal pattern (avg per month)" i={1}>
                <Data state={clim} skeleton={<div className="skeleton" style={{ height: 300 }} />}>{(c) => (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={c.map((x) => ({ ...x, m: MONTHS[x.month - 1] }))}>
                      <CartesianGrid stroke="var(--grid)" vertical={false} />
                      <XAxis dataKey="m" stroke="var(--muted)" fontSize={11} />
                      <YAxis yAxisId="l" stroke="var(--muted)" fontSize={11} />
                      <YAxis yAxisId="r" orientation="right" stroke="var(--sun)" fontSize={11} />
                      <Tooltip content={<Tip />} /><Legend />
                      <Bar yAxisId="l" dataKey="avgRain" name="Rain mm" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                      <Line yAxisId="r" dataKey="avgRainyDays" name="Rainy days" stroke="#fbbf24" strokeWidth={3} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}</Data>
              </Card>
              <Card title={year ? `${year} · month by month` : 'Monthly totals · all years'} i={2}>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={rows.map((r) => ({ ...r, k: year ? MONTHS[r.month - 1] : `${r.year}-${String(r.month).padStart(2, '0')}` }))}>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="k" stroke="var(--muted)" fontSize={10} interval={year ? 0 : 11} />
                    <YAxis stroke="var(--muted)" fontSize={11} />
                    <Tooltip content={<Tip unit=" mm" />} />
                    <Bar dataKey="total_rainfall_mm" name="Rainfall" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>
            </div>
            <div style={{ height: 18 }} />
            <Card title={`${title(st)} · rainfall heatmap (year × month)`} i={3}>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(12, minmax(46px, 1fr))', gap: 4, minWidth: 700 }}>
                  <span />{MONTHS.map((m) => <small key={m} style={{ textAlign: 'center', color: 'var(--muted)' }}>{m}</small>)}
                  {Array.from({ length: 15 }, (_, i) => 2010 + i).map((y) => (
                    <div key={y} style={{ display: 'contents' }}>
                      <small style={{ color: 'var(--muted)', alignSelf: 'center' }}>{y}</small>
                      {MONTHS.map((_, mi) => {
                        const c = grid[`${y}-${mi + 1}`];
                        const a = c ? Math.min(1, c.total_rainfall_mm / maxCell) : 0;
                        return <div key={mi} title={c ? `${MONTHS[mi]} ${y}: ${c.total_rainfall_mm} mm, ${c.rainy_days} rainy days` : ''}
                          style={{ height: 26, borderRadius: 7, background: `rgba(56,189,248,${0.08 + a * 0.92})`, display: 'grid', placeItems: 'center', fontSize: 10, color: a > 0.55 ? '#04142b' : 'var(--muted)' }}>{c ? Math.round(c.total_rainfall_mm) : ''}</div>;
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
