import { useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { title, useApi, useStations } from '../api';
import { Card, Data, Page, StationSelect, Tile, Tip, downloadCsv } from '../components/ui.jsx';

export default function Temperature() {
  const stations = useStations();
  const [st, setSt] = useState('CHENNAI');
  const [sort, setSort] = useState({ k: 'year', d: 1 });
  const res = useApi(`/hadoop/temperature?station=${st}`);

  const rows = useMemo(() => [...(res.data || [])].sort((a, b) => (a[sort.k] - b[sort.k]) * sort.d), [res.data, sort]);
  const th = (k, l) => <th onClick={() => setSort((s) => ({ k, d: s.k === k ? -s.d : 1 }))}>{l}{sort.k === k ? (sort.d > 0 ? ' ▲' : ' ▼') : ''}</th>;

  return (
    <Page title="Temperature Analysis" sub="MapReduce Job 1 · key = STATION-YEAR · reducer emits mean/max/min per group."
      actions={<div className="controls"><StationSelect stations={stations} value={st} onChange={setSt} /><button className="btn ghost" onClick={() => downloadCsv(`temperature_${st}.csv`, rows)}>⬇ CSV</button></div>}>
      <Data state={res}>{(d) => {
        const hi = d.reduce((a, x) => (x.highest_tmax > a.highest_tmax ? x : a));
        const lo = d.reduce((a, x) => (x.lowest_tmax < a.lowest_tmax ? x : a));
        const avg = (k) => d.reduce((a, x) => a + x[k], 0) / d.length;
        return (
          <>
            <div className="tiles">
              <Tile i={0} label="Mean max temp" value={avg('avg_tmax')} decimals={1} unit="°C" />
              <Tile i={1} label="Mean min temp" value={avg('avg_tmin')} decimals={1} unit="°C" />
              <Tile i={2} label="Hottest day" value={hi.highest_tmax} decimals={1} unit="°C" sub={`in ${hi.year}`} />
              <Tile i={3} label="Coolest max" value={lo.lowest_tmax} decimals={1} unit="°C" sub={`in ${lo.year}`} />
            </div>
            <div className="grid g2">
              <Card title={`${title(st)} · yearly averages`} i={1}>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={d}>
                    <defs>
                      <linearGradient id="ax" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbbf24" stopOpacity={0.5} /><stop offset="1" stopColor="#fbbf24" stopOpacity={0} /></linearGradient>
                      <linearGradient id="an" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#38bdf8" stopOpacity={0.45} /><stop offset="1" stopColor="#38bdf8" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="year" stroke="var(--muted)" fontSize={11} />
                    <YAxis stroke="var(--muted)" fontSize={11} unit="°" domain={['auto', 'auto']} />
                    <Tooltip content={<Tip unit="°C" />} /><Legend />
                    <Area dataKey="avg_tmax" name="Avg max" stroke="#fbbf24" strokeWidth={3} fill="url(#ax)" />
                    <Area dataKey="avg_tmin" name="Avg min" stroke="#38bdf8" strokeWidth={3} fill="url(#an)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>
              <Card title="Yearly extremes of daily max" i={2}>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={d}>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="year" stroke="var(--muted)" fontSize={11} />
                    <YAxis stroke="var(--muted)" fontSize={11} unit="°" domain={['auto', 'auto']} />
                    <Tooltip content={<Tip unit="°C" />} /><Legend />
                    <Line dataKey="highest_tmax" name="Highest Tmax" stroke="#fb7185" strokeWidth={3} dot={{ r: 3 }} />
                    <Line dataKey="lowest_tmax" name="Lowest Tmax" stroke="#a78bfa" strokeWidth={3} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>
            </div>
            <div style={{ height: 18 }} />
            <Card title="Reducer output" i={3}>
              <div className="scroll"><table>
                <thead><tr>{th('year', 'Year')}{th('avg_tmax', 'Avg Tmax')}{th('avg_tmin', 'Avg Tmin')}{th('highest_tmax', 'Highest')}{th('lowest_tmax', 'Lowest')}{th('observations', 'Obs')}</tr></thead>
                <tbody>{rows.map((r) => <tr key={r.year}><td>{r.year}</td><td>{r.avg_tmax}</td><td>{r.avg_tmin}</td><td>{r.highest_tmax}</td><td>{r.lowest_tmax}</td><td>{r.observations}</td></tr>)}</tbody>
              </table></div>
            </Card>
          </>
        );
      }}</Data>
    </Page>
  );
}
