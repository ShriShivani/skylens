import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { title, useApi, useStations } from '../api';
import { Card, Data, Page, StationSelect, Tile, Tip, downloadCsv } from '../components/ui.jsx';

export default function Extremes() {
  const stations = useStations();
  const [heat, setHeat] = useState(35);
  const [rain, setRain] = useState(50);
  const [wind, setWind] = useState(40);
  const [dw, setDw] = useState(40);
  const [dh, setDh] = useState(35); // debounced
  const [dr, setDr] = useState(50);
  const [st, setSt] = useState('');
  const [type, setType] = useState('');
  const [year, setYear] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => { const t = setTimeout(() => { setDh(heat); setDr(rain); setDw(wind); }, 250); return () => clearTimeout(t); }, [heat, rain, wind]);
  useEffect(() => setPage(0), [st, type, year]);

  const custom = useApi(`/hadoop/extremes/custom?heat=${dh}&rain=${dr}&wind=${dw}`);
  const list = useApi(`/hadoop/extremes?limit=50&offset=${page * 50}${st ? `&station=${st}` : ''}${type ? `&type=${type}` : ''}${year ? `&year=${year}` : ''}`);

  return (
    <Page title="Extreme Events" sub="MapReduce Job 3 flags days at or above the thresholds. Drag the sliders to see how many events other thresholds would catch.">
      <div className="grid g2">
        <Card title="Threshold lab" i={1}>
          <label>🔥 Heat ≥ <b style={{ color: 'var(--coral)' }}>{heat}°C</b></label>
          <input className="slider" type="range" min={30} max={47} value={heat} onChange={(e) => setHeat(+e.target.value)} />
          <label>🌧️ Heavy rain ≥ <b style={{ color: 'var(--sky)' }}>{rain} mm</b></label>
          <input className="slider" type="range" min={20} max={150} step={5} value={rain} onChange={(e) => setRain(+e.target.value)} />
          <label>💨 High wind ≥ <b style={{ color: 'var(--violet)' }}>{wind} km/h</b></label>
          <input className="slider" type="range" min={20} max={100} step={5} value={wind} onChange={(e) => setWind(+e.target.value)} />
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>Recomputed server-side from the raw CSV. The Hadoop job defaults to 35°C / 50 mm and accepts <code className="mono">-Dweather.heat.threshold</code> / <code className="mono">-Dweather.rain.threshold</code> / <code className="mono">-Dweather.wind.threshold</code>.</p>
          <Data state={custom} skeleton={<div className="skeleton" />}>{(c) => (
            <div className="tiles" style={{ marginTop: 14, marginBottom: 0 }}>
              <Tile label="Events caught" value={c.total} />
              <Tile label="Heat days" value={c.byStation.reduce((a, x) => a + x.heat, 0)} />
              <Tile label="Rain days" value={c.byStation.reduce((a, x) => a + x.rain, 0)} />
              <Tile label="Wind days" value={c.byStation.reduce((a, x) => a + x.wind, 0)} />
            </div>
          )}</Data>
        </Card>
        <Card title="Events by station at these thresholds" i={2}>
          <Data state={custom} skeleton={<div className="skeleton" style={{ height: 340 }} />}>{(c) => (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={c.byStation.map((x) => ({ ...x, name: title(x.station) }))}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted)" fontSize={10} interval={0} angle={-40} textAnchor="end" height={70} />
                <YAxis stroke="var(--muted)" fontSize={11} />
                <Tooltip content={<Tip />} cursor={{ fill: 'rgba(255,255,255,.05)' }} /><Legend verticalAlign="top" />
                <Bar dataKey="heat" name="Heat" stackId="a" fill="#fb7185" />
                <Bar dataKey="rain" name="Heavy rain" stackId="a" fill="#38bdf8" />
                <Bar dataKey="wind" name="High wind" stackId="a" fill="#a78bfa" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}</Data>
        </Card>
      </div>
      <div style={{ height: 18 }} />
      <Card title="Event log (Hadoop output)" i={3}
        >
        <div className="controls" style={{ marginBottom: 14 }}>
          <StationSelect all stations={stations} value={st} onChange={setSt} />
          <select value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option><option value="EXTREME_HEAT">Heat</option><option value="HEAVY_RAIN">Heavy rain</option><option value="HIGH_WIND">High wind</option></select>
          <select value={year} onChange={(e) => setYear(e.target.value)}><option value="">All years</option>{Array.from({ length: 15 }, (_, i) => 2010 + i).map((y) => <option key={y}>{y}</option>)}</select>
          <button className="btn ghost" onClick={() => list.data && downloadCsv('extremes_page.csv', list.data.rows)}>⬇ CSV (page)</button>
        </div>
        <Data state={list} skeleton={<div className="skeleton" style={{ height: 300 }} />}>{(d) => (
          <>
            <div className="scroll"><table>
              <thead><tr><th>Date</th><th>Station</th><th>Event</th><th>Value</th></tr></thead>
              <tbody>{d.rows.map((r, i) => (
                <tr key={i}><td className="mono">{r.date}</td><td>{title(r.station)}</td>
                  <td><span className={`badge ${r.type === 'EXTREME_HEAT' ? 'heat' : r.type === 'HIGH_WIND' ? 'warn' : 'rain'}`}>{r.type === 'EXTREME_HEAT' ? 'High temperature' : r.type === 'HIGH_WIND' ? 'High wind' : 'Heavy rainfall'}</span></td>
                  <td>{r.type === 'EXTREME_HEAT' ? `${r.tmax_c} °C` : r.type === 'HIGH_WIND' ? `${r.wind_kmh} km/h` : `${r.prcp_mm} mm`}</td></tr>
              ))}</tbody>
            </table></div>
            <div className="controls" style={{ justifyContent: 'space-between', marginTop: 12 }}>
              <small style={{ color: 'var(--muted)' }}>{d.total.toLocaleString()} events · page {page + 1} of {Math.max(1, Math.ceil(d.total / 50))}</small>
              <div className="controls">
                <button className="btn ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>← Prev</button>
                <button className="btn ghost" disabled={(page + 1) * 50 >= d.total} onClick={() => setPage(page + 1)}>Next →</button>
              </div>
            </div>
          </>
        )}</Data>
      </Card>
    </Page>
  );
}
