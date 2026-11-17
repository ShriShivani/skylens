import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { title, useApi } from '../api';
import { Card, Data, Page, Tile, Tip } from '../components/ui.jsx';

export default function Overview() {
  const sum = useApi('/hadoop/summary');
  const lb = useApi('/hadoop/leaderboard');
  const ex = useApi('/hadoop/extremes/summary');

  return (
    <Page title="Hadoop Overview" sub="Everything below was produced by three Java MapReduce jobs over 109,580 daily observations from 20 stations (2010–2024).">
      <Data state={sum}>{(s) => (
        <div className="tiles">
          <Tile i={0} label="Weather stations" value={s.stations} sub={`${s.firstYear} – ${s.lastYear}`} />
          <Tile i={1} label="Observations" value={s.observations} sub="mapped & reduced" />
          <Tile i={2} label="Avg max temp" value={s.avgTmax} unit="°C" decimals={1} sub={`min avg ${s.avgTmin}°C`} />
          <Tile i={3} label="Record high" value={s.hottest.highest_tmax} unit="°C" decimals={1} sub={`${title(s.hottest.station)} ${s.hottest.year}`} />
          <Tile i={4} label="Wettest station" value={title(s.wettest.station)} sub={`${s.wettest.totalMm.toLocaleString()} mm total`} />
          <Tile i={5} label="Avg humidity" value={s.avgHumidity ?? 0} unit="%" decimals={1} sub={s.humidest && `${title(s.humidest.station)} is most humid`} />
          <Tile i={6} label="Avg wind" value={s.avgWind ?? 0} unit="km/h" decimals={1} sub={s.peakGust && `peak gust ${s.peakGust.value} km/h`} />
          <Tile i={7} label="Heat events" value={s.heatEvents} sub="tmax ≥ 35°C" />
          <Tile i={8} label="Heavy-rain events" value={s.rainEvents} sub="rain ≥ 50 mm" />
          <Tile i={9} label="High-wind events" value={s.windEvents ?? 0} sub="wind ≥ 40 km/h" />
          <Tile i={10} label="Rainy days" value={s.rainyDays} sub={`${s.totalRainMm.toLocaleString()} mm fell`} />
        </div>
      )}</Data>
      <div className="grid g2">
        <Card title="Average max temperature by station" i={1}>
          <Data state={lb}>{(d) => {
            const rows = [...d].sort((a, b) => b.avgTmax - a.avgTmax).map((x) => ({ ...x, name: title(x.station) }));
            return (
              <ResponsiveContainer width="100%" height={460}>
                <BarChart data={rows} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid stroke="var(--grid)" horizontal={false} />
                  <XAxis type="number" domain={[24, 'dataMax']} stroke="var(--muted)" fontSize={11} unit="°" />
                  <YAxis type="category" dataKey="name" stroke="var(--muted)" fontSize={12} width={120} />
                  <Tooltip content={<Tip unit="°C" />} cursor={{ fill: 'rgba(255,255,255,.05)' }} />
                  <Bar dataKey="avgTmax" name="Avg Tmax" radius={[0, 8, 8, 0]}>
                    {rows.map((r, i) => <Cell key={r.station} fill={`hsl(${42 - (i / rows.length) * 42 + (i / rows.length) * 195}, 90%, 58%)`} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            );
          }}</Data>
        </Card>
        <div className="grid">
          <Card title="Annual rainfall by station (mm)" i={2}>
            <Data state={lb}>{(d) => {
              const rows = [...d].sort((a, b) => b.annualRain - a.annualRain).map((x) => ({ ...x, name: title(x.station) }));
              return (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={rows}>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--muted)" fontSize={10} interval={0} angle={-40} textAnchor="end" height={70} />
                    <YAxis stroke="var(--muted)" fontSize={11} />
                    <Tooltip content={<Tip unit=" mm" />} cursor={{ fill: 'rgba(255,255,255,.05)' }} />
                    <Bar dataKey="annualRain" name="Annual rain" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              );
            }}</Data>
          </Card>
          <Card title="Extreme events per year" i={3}>
            <Data state={ex}>{(d) => (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={d.byYear}>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  <XAxis dataKey="year" stroke="var(--muted)" fontSize={11} />
                  <YAxis yAxisId="a" stroke="var(--coral)" fontSize={11} />
                  <YAxis yAxisId="b" orientation="right" stroke="var(--sky)" fontSize={11} />
                  <Tooltip content={<Tip />} />
                  <Legend />
                  <Line yAxisId="a" dataKey="heat" name="Heat" stroke="#fb7185" strokeWidth={3} dot={false} />
                  <Line yAxisId="b" dataKey="rain" name="Heavy rain" stroke="#38bdf8" strokeWidth={3} dot={false} />
                  <Line yAxisId="b" dataKey="wind" name="High wind" stroke="#a78bfa" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}</Data>
          </Card>
        </div>
      </div>
    </Page>
  );
}
