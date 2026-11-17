import { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PALETTE, title, useApi, useStations } from '../api';
import { Card, Data, Page, Tip } from '../components/ui.jsx';

export default function Compare() {
  const stations = useStations();
  const [sel, setSel] = useState(['CHENNAI', 'DELHI', 'MUMBAI']);
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 5 ? [...s, id] : s));
  const res = useApi(sel.length ? `/hadoop/compare?stations=${sel.join(',')}` : null);
  const lb = useApi('/hadoop/leaderboard');

  const merge = (data, pick) => {
    const years = [...new Set(data.flatMap((d) => pick(d).map((x) => x.year)))].sort();
    return years.map((y) => Object.fromEntries([['year', y], ...data.map((d) => [d.station, pick(d).find((x) => x.year === y)?.v])]));
  };

  return (
    <Page title="Compare Stations" sub="Pick up to five stations and see how their climates diverge year by year.">
      <Card i={1}><div className="chips">{stations.map((s) => <button key={s.id} className={`chip ${sel.includes(s.id) ? 'on' : ''}`} onClick={() => toggle(s.id)}>{s.name}</button>)}</div></Card>
      <div style={{ height: 18 }} />
      <Data state={res}>{(d) => {
        const charts = [
          ['Average max temperature (°C)', merge(d, (x) => x.temperature.map((t) => ({ year: t.year, v: t.avg_tmax }))), '°C'],
          ['Average min temperature (°C)', merge(d, (x) => x.temperature.map((t) => ({ year: t.year, v: t.avg_tmin }))), '°C'],
          ['Annual rainfall (mm)', merge(d, (x) => x.rainfallByYear.map((t) => ({ year: t.year, v: +t.total.toFixed(0) }))), ' mm'],
          ['Average humidity (%)', merge(d, (x) => (x.atmosphereByYear || []).map((t) => ({ year: t.year, v: t.humidity }))), '%'],
          ['Average wind speed (km/h)', merge(d, (x) => (x.atmosphereByYear || []).map((t) => ({ year: t.year, v: t.wind }))), ' km/h'],
          ['Rainy days per year', merge(d, (x) => x.rainfallByYear.map((t) => ({ year: t.year, v: t.rainy }))), ' days'],
        ];
        return (
          <div className="grid g2">
            {charts.map(([t, data, unit], i) => (
              <Card key={t} title={t} i={i + 1}>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data}>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="year" stroke="var(--muted)" fontSize={11} />
                    <YAxis stroke="var(--muted)" fontSize={11} domain={['auto', 'auto']} />
                    <Tooltip content={<Tip unit={unit} />} /><Legend />
                    {d.map((s, k) => <Line key={s.station} dataKey={s.station} name={title(s.station)} stroke={PALETTE[k]} strokeWidth={2.6} dot={false} />)}
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            ))}
            <Card title="Climate fingerprint" i={5}>
              <Data state={lb} skeleton={<div className="skeleton" />}>{(all) => {
                const keys = [['avgTmax', 'Avg max'], ['avgTmin', 'Avg min'], ['peak', 'Record high'], ['annualRain', 'Rainfall'], ['avgHumidity', 'Humidity'], ['avgWind', 'Wind']];
                const rng = Object.fromEntries(keys.map(([k]) => [k, [Math.min(...all.map((x) => x[k] ?? 0)), Math.max(...all.map((x) => x[k] ?? 0))]]));
                const rows = keys.map(([k, l]) => ({ axis: l, ...Object.fromEntries(sel.map((id) => { const x = all.find((a) => a.station === id); return [id, x && x[k] != null ? Math.round(((x[k] - rng[k][0]) / (rng[k][1] - rng[k][0] || 1)) * 100) : 0]; })) }));
                return (
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={rows}>
                      <PolarGrid stroke="var(--grid)" /><PolarAngleAxis dataKey="axis" stroke="var(--muted)" fontSize={12} />
                      {sel.map((id, k) => <Radar key={id} dataKey={id} name={title(id)} stroke={PALETTE[k]} fill={PALETTE[k]} fillOpacity={0.15} />)}
                      <Legend /><Tooltip content={<Tip unit=" /100" />} />
                    </RadarChart>
                  </ResponsiveContainer>
                );
              }}</Data>
            </Card>
          </div>
        );
      }}</Data>
    </Page>
  );
}
