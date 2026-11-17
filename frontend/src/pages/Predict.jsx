import { useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { title, useApi, useStations } from '../api';
import { Card, Data, Page, StationSelect, Tile, Tip } from '../components/ui.jsx';

export default function Predict() {
  const stations = useStations();
  const [st, setSt] = useState('DELHI');
  const [years, setYears] = useState(5);
  const res = useApi(`/hadoop/predict?station=${st}&years=${years}`);

  return (
    <Page title="Trends & Forecast" sub="Ordinary-least-squares regression over the yearly MapReduce aggregates, projected forward. A statistical trend line, not a meteorological forecast."
      actions={<div className="controls"><StationSelect stations={stations} value={st} onChange={setSt} />
        <select value={years} onChange={(e) => setYears(+e.target.value)}>{[3, 5, 10, 15].map((y) => <option key={y} value={y}>+{y} years</option>)}</select></div>}>
      <Data state={res}>{(d) => {
        const hist = d.history.map((h) => ({ ...h, kind: 'hist' }));
        const proj = [{ year: hist.at(-1).year, tmaxF: hist.at(-1).fit, rainF: hist.at(-1).rain }, ...d.forecast.map((f) => ({ year: f.year, tmaxF: f.tmax, tminF: f.tmin, rainF: f.rain }))];
        const data = [...hist, ...proj.slice(1)].sort((a, b) => a.year - b.year);
        proj.forEach((p) => { const r = data.find((x) => x.year === p.year); Object.assign(r, p); });
        const T = d.trend;
        return (
          <>
            <div className="tiles">
              <Tile i={0} label="Max-temp trend" value={T.tmaxPerDecade} decimals={2} unit="°C / decade" sub={T.tmaxPerDecade >= 0 ? 'warming' : 'cooling'} />
              <Tile i={1} label="Min-temp trend" value={T.tminPerDecade} decimals={2} unit="°C / decade" />
              <Tile i={2} label="Rainfall trend" value={T.rainPerDecade} unit="mm / decade" />
              <Tile i={3} label="Fit quality (R²)" value={T.r2} decimals={3} sub={T.r2 < 0.3 ? 'weak trend — mostly noise' : 'meaningful trend'} />
            </div>
            <div className="grid g2">
              <Card title={`${title(st)} · max temperature (°C)`} i={1}>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={data}>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="year" stroke="var(--muted)" fontSize={11} />
                    <YAxis stroke="var(--muted)" fontSize={11} domain={['auto', 'auto']} />
                    <Tooltip content={<Tip unit="°C" />} /><Legend />
                    <ReferenceLine x={hist.at(-1).year} stroke="var(--sun)" strokeDasharray="4 4" label={{ value: 'today', fill: 'var(--sun)', fontSize: 11 }} />
                    <Line dataKey="tmax" name="Observed" stroke="#fbbf24" strokeWidth={3} dot={{ r: 3 }} connectNulls />
                    <Line dataKey="fit" name="Trend fit" stroke="#38bdf8" strokeWidth={2} dot={false} />
                    <Line dataKey="tmaxF" name="Projection" stroke="#fb7185" strokeWidth={3} strokeDasharray="6 5" dot={{ r: 4 }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>
              <Card title="Annual rainfall (mm)" i={2}>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={data}>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="year" stroke="var(--muted)" fontSize={11} />
                    <YAxis stroke="var(--muted)" fontSize={11} />
                    <Tooltip content={<Tip unit=" mm" />} /><Legend />
                    <Bar dataKey="rain" name="Observed" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="rainF" name="Projected" fill="#a78bfa" radius={[6, 6, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>
            </div>
            <div style={{ height: 18 }} />
            <Card title="Projection table" i={3}>
              <table><thead><tr><th>Year</th><th>Avg Tmax</th><th>Avg Tmin</th><th>Rainfall</th></tr></thead>
                <tbody>{d.forecast.map((f) => <tr key={f.year}><td>{f.year}</td><td>{f.tmax} °C</td><td>{f.tmin} °C</td><td>{f.rain} mm</td></tr>)}</tbody></table>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 10 }}>Method: {d.method}. The dataset is synthetic, so the trends demonstrate the pipeline rather than real climate change.</p>
            </Card>
          </>
        );
      }}</Data>
    </Page>
  );
}
