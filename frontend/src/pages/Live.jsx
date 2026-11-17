import { useEffect, useRef, useState } from 'react';
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, iconUrl, useApi, useStations } from '../api';
import { Card, Data, Page, Tip } from '../components/ui.jsx';
import { moodFrom, useMood } from '../components/Sky.jsx';
import { usePrefs } from '../components/prefs.jsx';
import { motion } from 'framer-motion';

const time = (ts, tz, o = { hour: '2-digit', minute: '2-digit' }) => new Date((ts + tz) * 1000).toLocaleTimeString([], { ...o, timeZone: 'UTC' });
const dayName = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString([], { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
const compass = (d) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(d / 45) % 8];
const AQI_COLOR = ['', '#34d399', '#a3e635', '#fbbf24', '#f97316', '#fb7185'];

function SearchBox({ onPick }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const t = useRef();
  useEffect(() => {
    clearTimeout(t.current);
    if (q.trim().length < 2) return setList([]);
    t.current = setTimeout(() => api(`/live/geocode?q=${encodeURIComponent(q)}`).then(setList).catch(() => setList([])), 300);
  }, [q]);
  return (
    <div className="search">
      <span className="mag">🔍</span>
      <input type="search" placeholder="Search any city in the world…" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length > 0 && (
        <div className="sugg">
          {list.map((c, i) => (
            <button key={i} onClick={() => { onPick(c); setQ(''); setList([]); }}>
              <b>{c.name}</b> <span style={{ color: 'var(--muted)' }}>{[c.state, c.country].filter(Boolean).join(', ')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Live() {
  const stations = useStations();
  const { t, deg, unit, favs, toggleFav } = usePrefs();
  const { setMood } = useMood();
  const [loc, setLoc] = useState({ station: 'CHENNAI', label: 'Chennai' });
  const qs = loc.lat ? `lat=${loc.lat}&lon=${loc.lon}` : `station=${loc.station}`;
  const cur = useApi(`/live/current?${qs}`, 300000);
  const fc = useApi(`/live/forecast?${qs}`, 300000);
  const air = useApi(`/live/air?${qs}`, 300000);
  const alerts = useApi(`/live/alerts?${qs}`, 300000);
  const favKey = loc.lat ? `${loc.lat},${loc.lon}` : loc.station;
  const isFav = favs.some((f) => f.key === favKey);
  const insight = useApi(loc.station && !loc.lat ? `/live/insight?station=${loc.station}` : null);

  useEffect(() => { if (cur.data) setMood(moodFrom(cur.data)); }, [cur.data, setMood]);

  const locate = () => navigator.geolocation?.getCurrentPosition(
    (p) => setLoc({ lat: p.coords.latitude.toFixed(4), lon: p.coords.longitude.toFixed(4), label: 'My location' }),
    () => alert('Location permission denied'),
  );

  return (
    <Page title="Live Weather" sub="Realtime conditions from OpenWeather, set against what 15 years of Hadoop-processed history says is normal."
      actions={
        <div className="controls">
          <SearchBox onPick={(c) => setLoc({ lat: c.lat, lon: c.lon, label: c.name })} />
          <button className="btn ghost" onClick={locate}>📍 Near me</button>
        </div>
      }>
      <Card i={1}>
        {favs.length > 0 && (
          <div className="chips" style={{ marginBottom: 10 }}>
            {favs.map((f) => (
              <button key={f.key} className={`chip ${favKey === f.key ? 'on' : ''}`} onClick={() => setLoc(f.loc)}>★ {f.loc.label}</button>
            ))}
          </div>
        )}
        <div className="chips">
          {stations.map((s) => (
            <button key={s.id} className={`chip ${loc.station === s.id && !loc.lat ? 'on' : ''}`} onClick={() => setLoc({ station: s.id, label: s.name })}>{s.name}</button>
          ))}
        </div>
      </Card>
      <div style={{ height: 18 }} />

      {alerts.data?.alerts?.length > 0 && (
        <div className="alerts">
          {alerts.data.alerts.map((a, i) => (
            <motion.div key={a.title} className={`alert ${a.level}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
              <span className="ai">{a.icon}</span><div><b>{a.title}</b><div>{a.text}</div></div>
            </motion.div>
          ))}
        </div>
      )}

      <Data state={cur}>{(w) => {
        const tz = w.timezone;
        return (
          <div className="hero">
            <Card className="glow" i={2}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 26 }}>{w.name || loc.label}, {w.sys.country}</h2>
                <button className="icon-btn" title={isFav ? 'Remove favourite' : 'Save as favourite'} onClick={() => toggleFav({ key: favKey, loc: loc.lat ? { ...loc, label: w.name || loc.label } : loc })}>{isFav ? '★' : '☆'}</button>
                <span className="badge warn">{time(w.dt, tz, { weekday: 'short', hour: '2-digit', minute: '2-digit' })} local</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, margin: '14px 0 4px', flexWrap: 'wrap' }}>
                <div className="temp">{t(w.main.temp)}°</div>
                <div>
                  <img className="wicon" src={iconUrl(w.weather[0].icon)} alt="" />
                  <div style={{ fontSize: 20, textTransform: 'capitalize' }}>{w.weather[0].description}</div>
                  <div style={{ color: 'var(--muted)' }}>Feels like {t(w.main.feels_like)}° · H {t(w.main.temp_max)}° L {t(w.main.temp_min)}°</div>
                </div>
              </div>
              <div className="kv">
                <div><b>{w.main.humidity}%</b><span>Humidity</span></div>
                <div><b>{(w.wind.speed * 3.6).toFixed(1)} km/h {w.wind.deg != null && compass(w.wind.deg)}</b><span>Wind</span></div>
                <div><b>{w.main.pressure} hPa</b><span>Pressure</span></div>
                <div><b>{((w.visibility ?? 0) / 1000).toFixed(1)} km</b><span>Visibility</span></div>
                <div><b>{time(w.sys.sunrise, tz)}</b><span>Sunrise 🌅</span></div>
                <div><b>{time(w.sys.sunset, tz)}</b><span>Sunset 🌇</span></div>
              </div>
            </Card>

            <div className="grid" style={{ alignContent: 'start' }}>
              <Card title="Comfort" i={3}>
                <div style={{ fontSize: 30, fontWeight: 700 }}>{t(w.derived.heatIndex, 1)}{deg} <span className="badge warn" style={{ verticalAlign: 'middle' }}>{w.derived.comfort}</span></div>
                <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Heat index from temperature + humidity (Rothfusz)</div>
              </Card>
              <Card title="Air quality" i={4}>
                <Data state={air} skeleton={<div className="skeleton" />}>{(a) => (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 62, height: 62, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 800, color: '#04142b', background: AQI_COLOR[a.aqi] }}>{a.aqi}</div>
                      <div><b style={{ fontSize: 20 }}>{a.label}</b><div style={{ color: 'var(--muted)', fontSize: 13 }}>PM2.5 {a.components.pm2_5?.toFixed(1)} · PM10 {a.components.pm10?.toFixed(1)} µg/m³</div></div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
                      {[1, 2, 3, 4, 5].map((i) => <i key={i} style={{ flex: 1, height: 6, borderRadius: 4, background: AQI_COLOR[i], opacity: i <= a.aqi ? 1 : 0.2 }} />)}
                    </div>
                  </>
                )}</Data>
              </Card>
              <Card title="Versus Hadoop normal" i={5}>
                {insight.data?.normal != null ? (
                  <>
                    <div style={{ fontSize: 30, fontWeight: 700, color: insight.data.anomaly > 0 ? 'var(--coral)' : 'var(--sky)' }}>
                      {insight.data.anomaly > 0 ? '+' : ''}{(unit === 'C' ? insight.data.anomaly : insight.data.anomaly * 1.8).toFixed(1)}{deg}
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>Now {t(insight.data.live, 1)}° vs 15-yr mean {t(insight.data.normal, 1)}° for this month</div>
                    {insight.data.humidity?.normal != null && (
                      <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 13, flexWrap: 'wrap' }}>
                        <span>💧 {insight.data.humidity.live}% vs {insight.data.humidity.normal}% <b style={{ color: insight.data.humidity.anomaly > 0 ? 'var(--sky)' : 'var(--sun)' }}>({insight.data.humidity.anomaly > 0 ? '+' : ''}{insight.data.humidity.anomaly})</b></span>
                        <span>💨 {insight.data.wind.live} vs {insight.data.wind.normal} km/h <b style={{ color: insight.data.wind.anomaly > 0 ? 'var(--violet)' : 'var(--sun)' }}>({insight.data.wind.anomaly > 0 ? '+' : ''}{insight.data.wind.anomaly})</b></span>
                      </div>
                    )}
                  </>
                ) : <div style={{ color: 'var(--muted)', fontSize: 14 }}>Pick one of the 20 Hadoop stations to compare against historical data.</div>}
              </Card>
            </div>
          </div>
        );
      }}</Data>

      <Data state={fc}>{(f) => {
        const hours = f.hourly.slice(0, 16);
        const gmin = Math.min(...f.daily.map((d) => d.min)), gmax = Math.max(...f.daily.map((d) => d.max));
        const tz = f.city.timezone;
        return (
          <div className="grid">
            <Card title="Next 48 hours" i={1}>
              <div className="strip">
                {hours.map((h) => (
                  <div className="hr" key={h.ts}>
                    <small>{time(h.ts, tz)}</small><img src={iconUrl(h.icon, false)} alt="" />
                    <b>{t(h.temp)}°</b><em>{h.pop}% ☔</em>
                  </div>
                ))}
              </div>
            </Card>
            <div className="grid g2">
              <Card title="Temperature & rain chance" i={2}>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={f.hourly.map((h) => ({ ...h, temp: +t(h.temp, 1), feels: +t(h.feels, 1), t: time(h.ts, tz, { weekday: 'short', hour: '2-digit' }) }))}>
                    <defs><linearGradient id="gt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbbf24" stopOpacity={0.6} /><stop offset="1" stopColor="#38bdf8" stopOpacity={0.05} /></linearGradient></defs>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="t" stroke="var(--muted)" fontSize={11} interval={4} />
                    <YAxis yAxisId="l" stroke="var(--muted)" fontSize={11} unit="°" />
                    <YAxis yAxisId="r" orientation="right" stroke="var(--muted)" fontSize={11} unit="%" domain={[0, 100]} />
                    <Tooltip content={<Tip />} />
                    <Bar yAxisId="r" dataKey="pop" name="Rain chance %" fill="#38bdf8" opacity={0.35} radius={[4, 4, 0, 0]} />
                    <Area yAxisId="l" type="monotone" dataKey="temp" name={`Temp ${deg}`} stroke="#fbbf24" strokeWidth={3} fill="url(#gt)" />
                    <Line yAxisId="l" type="monotone" dataKey="feels" name="Feels like" stroke="#fb7185" strokeDasharray="4 4" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>
              <Card title="5-day outlook" i={3}>
                {f.daily.map((d) => (
                  <div className="day" key={d.date}>
                    <b>{dayName(d.date)}</b><img src={iconUrl(d.icon, false)} alt="" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <small style={{ width: 28 }}>{t(d.min)}°</small>
                      <div className="range" style={{ flex: 1 }}><i style={{ left: `${((d.min - gmin) / (gmax - gmin || 1)) * 100}%`, right: `${100 - ((d.max - gmin) / (gmax - gmin || 1)) * 100}%` }} /></div>
                      <small style={{ width: 28 }}>{t(d.max)}°</small>
                    </div>
                    <small style={{ color: 'var(--sky)' }}>{d.pop}% ☔</small>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        );
      }}</Data>
    </Page>
  );
}
