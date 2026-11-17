import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// load backend/.env no matter which directory the server is started from
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { STATIONS, byId } from './stations.js';
import * as H from './hadoop.js';
import { startHdfsSync, hdfsState } from './hdfs.js';

const PORT = process.env.PORT || 5000;
const KEY = process.env.OPENWEATHER_API_KEY;
const OWM = 'https://api.openweathermap.org';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || true }));
app.use(compression());
app.use(express.json());

// ---------- tiny TTL cache + OpenWeather proxy (key never leaves the server) ----------
const cache = new Map();
async function owm(pathname, params, ttl = 600) {
  if (!KEY) throw Object.assign(new Error('OPENWEATHER_API_KEY missing'), { status: 500 });
  const qs = new URLSearchParams({ ...params, appid: KEY, units: 'metric' }).toString();
  const url = `${OWM}${pathname}?${qs}`;
  const hit = cache.get(url);
  if (hit && hit.exp > Date.now()) return hit.data;
  const r = await fetch(url);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.message || `OpenWeather ${r.status}`), { status: r.status === 401 ? 502 : r.status });
  cache.set(url, { data, exp: Date.now() + ttl * 1000 });
  return data;
}
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

async function resolveLoc(q) {
  if (q.lat && q.lon) return { lat: +q.lat, lon: +q.lon };
  const st = byId[String(q.station || '').toUpperCase()];
  if (st) return { lat: st.lat, lon: st.lon };
  if (q.city) {
    const g = await owm('/geo/1.0/direct', { q: q.city, limit: 1 }, 86400);
    if (!g.length) throw Object.assign(new Error(`City "${q.city}" not found`), { status: 404 });
    return { lat: g[0].lat, lon: g[0].lon, name: g[0].name, country: g[0].country, state: g[0].state };
  }
  throw Object.assign(new Error('Provide city, station or lat/lon'), { status: 400 });
}

// Derived metrics: heat index (Rothfusz, °C), comfort label
function heatIndexC(t, rh) {
  const f = t * 9 / 5 + 32;
  if (f < 80) return t;
  const hi = -42.379 + 2.04901523 * f + 10.14333127 * rh - 0.22475541 * f * rh - 0.00683783 * f * f
    - 0.05481717 * rh * rh + 0.00122874 * f * f * rh + 0.00085282 * f * rh * rh - 0.00000199 * f * f * rh * rh;
  return (hi - 32) * 5 / 9;
}
const comfort = (hi) => (hi >= 54 ? 'Extreme danger' : hi >= 41 ? 'Danger' : hi >= 32 ? 'Extreme caution' : hi >= 27 ? 'Caution' : hi >= 15 ? 'Comfortable' : 'Chilly');

// ---------- live weather ----------
app.get('/api/live/geocode', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  const g = await owm('/geo/1.0/direct', { q, limit: 6 }, 86400);
  res.json(g.map((x) => ({ name: x.name, state: x.state, country: x.country, lat: x.lat, lon: x.lon })));
}));

app.get('/api/live/current', wrap(async (req, res) => {
  const loc = await resolveLoc(req.query);
  const w = await owm('/data/2.5/weather', { lat: loc.lat, lon: loc.lon });
  const hi = heatIndexC(w.main.temp, w.main.humidity);
  res.json({ ...w, location: loc, derived: { heatIndex: +hi.toFixed(1), comfort: comfort(hi) } });
}));

app.get('/api/live/forecast', wrap(async (req, res) => {
  const loc = await resolveLoc(req.query);
  const f = await owm('/data/2.5/forecast', { lat: loc.lat, lon: loc.lon });
  const hourly = f.list.map((x) => ({
    ts: x.dt, temp: x.main.temp, feels: x.main.feels_like, humidity: x.main.humidity,
    pop: Math.round((x.pop || 0) * 100), rain: x.rain?.['3h'] || 0, wind: x.wind.speed,
    icon: x.weather[0].icon, main: x.weather[0].main, desc: x.weather[0].description,
  }));
  const days = {};
  for (const h of hourly) {
    const d = new Date((h.ts + f.city.timezone) * 1000).toISOString().slice(0, 10);
    const o = (days[d] ||= { date: d, min: Infinity, max: -Infinity, rain: 0, pop: 0, icons: {} });
    o.min = Math.min(o.min, h.temp); o.max = Math.max(o.max, h.temp);
    o.rain += h.rain; o.pop = Math.max(o.pop, h.pop);
    o.icons[h.icon] = (o.icons[h.icon] || 0) + 1;
    o.main = o.main || h.main;
  }
  const daily = Object.values(days).map((d) => ({
    ...d, icon: Object.entries(d.icons).sort((a, b) => b[1] - a[1])[0][0].replace('n', 'd'), icons: undefined,
  }));
  res.json({ city: f.city, hourly, daily, location: loc });
}));

app.get('/api/live/air', wrap(async (req, res) => {
  const loc = await resolveLoc(req.query);
  const a = await owm('/data/2.5/air_pollution', { lat: loc.lat, lon: loc.lon }, 900);
  const x = a.list?.[0];
  const labels = ['', 'Good', 'Fair', 'Moderate', 'Poor', 'Very poor'];
  res.json({ aqi: x?.main.aqi, label: labels[x?.main.aqi] || 'n/a', components: x?.components || {} });
}));

// Live board for all 20 stations
app.get('/api/live/stations', wrap(async (_req, res) => {
  const out = await Promise.all(STATIONS.map(async (s) => {
    try {
      const w = await owm('/data/2.5/weather', { lat: s.lat, lon: s.lon }, 600);
      return { ...s, temp: w.main.temp, humidity: w.main.humidity, wind: w.wind.speed, icon: w.weather[0].icon, main: w.weather[0].main, rain: w.rain?.['1h'] || 0 };
    } catch { return { ...s, error: true }; }
  }));
  res.json(out);
}));

// Live reading vs the Hadoop historical normal for the same station + calendar month
app.get('/api/live/insight', wrap(async (req, res) => {
  const st = byId[String(req.query.station || '').toUpperCase()];
  if (!st) return res.status(400).json({ error: 'Unknown station' });
  const w = await owm('/data/2.5/weather', { lat: st.lat, lon: st.lon });
  const month = new Date().getMonth() + 1;
  const rows = H.rawRows().filter((r) => r.station === st.id && +r.date.slice(5, 7) === month);
  if (!rows.length) return res.json({ station: st.id, live: w.main.temp, normal: null });
  const normal = rows.reduce((a, r) => a + (r.tmax + r.tmin) / 2, 0) / rows.length;
  const avg = (k) => { const v = rows.filter((r) => r[k] != null); return v.length ? v.reduce((a, r) => a + r[k], 0) / v.length : null; };
  const nh = avg('humidity'), nw = avg('wind');
  res.json({
    station: st.id, live: w.main.temp, normal: +normal.toFixed(1), anomaly: +(w.main.temp - normal).toFixed(1), month,
    humidity: { live: w.main.humidity, normal: nh && +nh.toFixed(1), anomaly: nh && +(w.main.humidity - nh).toFixed(1) },
    wind: { live: +(w.wind.speed * 3.6).toFixed(1), normal: nw && +nw.toFixed(1), anomaly: nw && +(w.wind.speed * 3.6 - nw).toFixed(1) },
  });
}));

// ---------- Hadoop results ----------
const pick = (arr, q) => arr.filter((r) =>
  (!q.station || r.station === String(q.station).toUpperCase()) &&
  (!q.year || r.year === +q.year) && (!q.month || r.month === +q.month));

app.get('/api/hadoop/stations', (_req, res) => res.json(STATIONS));
app.get('/api/hadoop/status', (_req, res) => res.json({ ...H.pipelineStatus(), hdfs: hdfsState() }));
app.get('/api/hadoop/temperature', (req, res) => res.json(pick(H.temperature(), req.query)));
app.get('/api/hadoop/rainfall', (req, res) => res.json(pick(H.rainfall(), req.query)));
app.get('/api/hadoop/atmosphere', (req, res) => res.json(pick(H.atmosphere(), req.query)));

app.get('/api/hadoop/extremes', (req, res) => {
  let rows = pick(H.extremes(), req.query);
  if (req.query.type) rows = rows.filter((r) => r.type === req.query.type);
  const total = rows.length;
  const limit = Math.min(+req.query.limit || 200, 5000);
  const offset = +req.query.offset || 0;
  res.json({ total, rows: rows.slice(offset, offset + limit) });
});

app.get('/api/hadoop/extremes/summary', (_req, res) => {
  const by = {};
  for (const e of H.extremes()) {
    const s = (by[e.station] ||= { station: e.station, heat: 0, rain: 0, wind: 0, maxTemp: 0, maxRain: 0, maxWind: 0 });
    if (e.type === 'EXTREME_HEAT') { s.heat++; s.maxTemp = Math.max(s.maxTemp, e.tmax_c); }
    else if (e.type === 'HEAVY_RAIN') { s.rain++; s.maxRain = Math.max(s.maxRain, e.prcp_mm); }
    else { s.wind++; s.maxWind = Math.max(s.maxWind, e.wind_kmh); }
  }
  const perYear = {};
  for (const e of H.extremes()) {
    const y = (perYear[e.year] ||= { year: e.year, heat: 0, rain: 0, wind: 0 });
    if (e.type === 'EXTREME_HEAT') y.heat++; else if (e.type === 'HEAVY_RAIN') y.rain++; else y.wind++;
  }
  res.json({ byStation: Object.values(by), byYear: Object.values(perYear).sort((a, b) => a.year - b.year) });
});

// Configurable thresholds: recompute from raw CSV (what Job 3 would emit with other -D values)
app.get('/api/hadoop/extremes/custom', (req, res) => {
  const heat = +req.query.heat || 35, rain = +req.query.rain || 50, wind = +req.query.wind || 40;
  const by = {};
  let total = 0;
  for (const r of H.rawRows()) {
    const h = r.tmax >= heat, p = r.prcp >= rain, w = r.wind != null && r.wind >= wind;
    if (!h && !p && !w) continue;
    const s = (by[r.station] ||= { station: r.station, heat: 0, rain: 0, wind: 0 });
    if (h) s.heat++;
    if (p) s.rain++;
    if (w) s.wind++;
    total++;
  }
  res.json({ heat, rain, wind, total, byStation: Object.values(by).sort((a, b) => b.heat + b.rain + b.wind - a.heat - a.rain - a.wind) });
});

function atmoSummary() {
  const a = H.atmosphere();
  if (!a.length) return {};
  const mean = (k) => a.reduce((s, x) => s + x[k], 0) / a.length;
  const byS = {};
  for (const x of a) { const o = (byS[x.station] ||= { station: x.station, h: 0, w: 0, n: 0 }); o.h += x.avg_humidity; o.w += x.avg_wind; o.n++; }
  const list = Object.values(byS).map((o) => ({ station: o.station, humidity: o.h / o.n, wind: o.w / o.n }));
  const humid = list.reduce((m, x) => (x.humidity > m.humidity ? x : m));
  const windy = list.reduce((m, x) => (x.wind > m.wind ? x : m));
  const gust = a.reduce((m, x) => (x.max_wind > m.max_wind ? x : m));
  return {
    avgHumidity: +mean('avg_humidity').toFixed(1), avgWind: +mean('avg_wind').toFixed(1),
    humidest: { station: humid.station, value: +humid.humidity.toFixed(1) },
    windiest: { station: windy.station, value: +windy.wind.toFixed(1) },
    peakGust: { station: gust.station, year: gust.year, month: gust.month, value: gust.max_wind },
  };
}

app.get('/api/hadoop/summary', (_req, res) => {
  const t = H.temperature(), r = H.rainfall(), e = H.extremes();
  const obs = t.reduce((a, x) => a + x.observations, 0);
  const hottest = t.reduce((a, x) => (x.highest_tmax > (a?.highest_tmax ?? -1) ? x : a), null);
  const coldest = t.reduce((a, x) => (x.lowest_tmax < (a?.lowest_tmax ?? 1e9) ? x : a), null);
  const rainByStation = {};
  for (const x of r) rainByStation[x.station] = (rainByStation[x.station] || 0) + x.total_rainfall_mm;
  const wettest = Object.entries(rainByStation).sort((a, b) => b[1] - a[1])[0];
  const years = [...new Set(t.map((x) => x.year))].sort();
  const avg = (k) => t.reduce((a, x) => a + x[k], 0) / (t.length || 1);
  res.json({
    stations: new Set(t.map((x) => x.station)).size,
    years: years.length, firstYear: years[0], lastYear: years.at(-1),
    observations: obs,
    avgTmax: +avg('avg_tmax').toFixed(2), avgTmin: +avg('avg_tmin').toFixed(2),
    hottest, coldest,
    wettest: wettest && { station: wettest[0], totalMm: +wettest[1].toFixed(1) },
    totalRainMm: +r.reduce((a, x) => a + x.total_rainfall_mm, 0).toFixed(0),
    rainyDays: r.reduce((a, x) => a + x.rainy_days, 0),
    ...atmoSummary(),
    heatEvents: e.filter((x) => x.type === 'EXTREME_HEAT').length,
    windEvents: e.filter((x) => x.type === 'HIGH_WIND').length,
    rainEvents: e.filter((x) => x.type === 'HEAVY_RAIN').length,
  });
});

// Station-level leaderboard (avg over all years)
app.get('/api/hadoop/leaderboard', (_req, res) => {
  const by = {};
  for (const x of H.temperature()) {
    const s = (by[x.station] ||= { station: x.station, n: 0, tmax: 0, tmin: 0, peak: -1e9, low: 1e9 });
    s.n++; s.tmax += x.avg_tmax; s.tmin += x.avg_tmin;
    s.peak = Math.max(s.peak, x.highest_tmax); s.low = Math.min(s.low, x.lowest_tmax);
  }
  const rain = {};
  for (const x of H.rainfall()) rain[x.station] = (rain[x.station] || 0) + x.total_rainfall_mm;
  const atmo = {};
  for (const x of H.atmosphere()) { const o = (atmo[x.station] ||= { h: 0, w: 0, n: 0 }); o.h += x.avg_humidity; o.w += x.avg_wind; o.n++; }
  const years = new Set(H.temperature().map((x) => x.year)).size || 1;
  res.json(Object.values(by).map((s) => ({
    station: s.station, avgTmax: +(s.tmax / s.n).toFixed(2), avgTmin: +(s.tmin / s.n).toFixed(2),
    peak: s.peak, low: s.low, annualRain: +((rain[s.station] || 0) / years).toFixed(0),
    avgHumidity: atmo[s.station] ? +(atmo[s.station].h / atmo[s.station].n).toFixed(1) : null,
    avgWind: atmo[s.station] ? +(atmo[s.station].w / atmo[s.station].n).toFixed(1) : null, ...(byId[s.station] && { lat: byId[s.station].lat, lon: byId[s.station].lon }),
  })));
});

// Monthly climatology of a station (avg monthly rainfall, rainy days)
app.get('/api/hadoop/climatology', (req, res) => {
  const rows = pick(H.rainfall(), { station: req.query.station });
  const m = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, rain: 0, rainy: 0, n: 0 }));
  for (const r of rows) { const o = m[r.month - 1]; o.rain += r.total_rainfall_mm; o.rainy += r.rainy_days; o.n++; }
  const am = Array.from({ length: 12 }, () => ({ h: 0, w: 0, g: 0, n: 0 }));
  for (const r of pick(H.atmosphere(), { station: req.query.station })) { const o = am[r.month - 1]; o.h += r.avg_humidity; o.w += r.avg_wind; o.g = Math.max(o.g, r.max_wind); o.n++; }
  res.json(m.map((o, i) => ({
    month: o.month, avgRain: o.n ? +(o.rain / o.n).toFixed(1) : 0, avgRainyDays: o.n ? +(o.rainy / o.n).toFixed(1) : 0,
    avgHumidity: am[i].n ? +(am[i].h / am[i].n).toFixed(1) : null, avgWind: am[i].n ? +(am[i].w / am[i].n).toFixed(1) : null, peakGust: am[i].n ? am[i].g : null,
  })));
});

app.get('/api/hadoop/compare', (req, res) => {
  const ids = String(req.query.stations || '').toUpperCase().split(',').filter(Boolean).slice(0, 5);
  const t = H.temperature(), r = H.rainfall();
  res.json(ids.map((id) => ({
    station: id,
    temperature: t.filter((x) => x.station === id),
    atmosphereByYear: Object.values(H.atmosphere().filter((x) => x.station === id).reduce((a, x) => {
      (a[x.year] ||= { year: x.year, h: 0, w: 0, n: 0 }); a[x.year].h += x.avg_humidity; a[x.year].w += x.avg_wind; a[x.year].n++; return a;
    }, {})).map((o) => ({ year: o.year, humidity: +(o.h / o.n).toFixed(1), wind: +(o.w / o.n).toFixed(1) })),
    rainfallByYear: Object.values(r.filter((x) => x.station === id).reduce((a, x) => {
      (a[x.year] ||= { year: x.year, total: 0, rainy: 0 }); a[x.year].total += x.total_rainfall_mm; a[x.year].rainy += x.rainy_days; return a;
    }, {})),
  })));
});

// Linear-regression trend + 5-year projection (no ML lib; pure OLS on Hadoop yearly aggregates)
app.get('/api/hadoop/predict', (req, res) => {
  const id = String(req.query.station || '').toUpperCase();
  const horizon = Math.min(+req.query.years || 5, 15);
  const t = H.temperature().filter((x) => x.station === id).sort((a, b) => a.year - b.year);
  if (t.length < 3) return res.status(404).json({ error: 'Not enough data' });
  const rain = {};
  for (const x of H.rainfall().filter((x) => x.station === id)) rain[x.year] = (rain[x.year] || 0) + x.total_rainfall_mm;
  const years = t.map((x) => x.year);
  const mk = (ys) => { const m = H.linreg(years, ys); return { ...m, f: (y) => m.intercept + m.slope * y }; };
  const tm = mk(t.map((x) => x.avg_tmax)), tn = mk(t.map((x) => x.avg_tmin)), rn = mk(years.map((y) => rain[y] || 0));
  const last = years.at(-1);
  const history = t.map((x) => ({ year: x.year, tmax: x.avg_tmax, tmin: x.avg_tmin, rain: +(rain[x.year] || 0).toFixed(0), fit: +tm.f(x.year).toFixed(2) }));
  const forecast = Array.from({ length: horizon }, (_, i) => {
    const y = last + i + 1;
    return { year: y, tmax: +tm.f(y).toFixed(2), tmin: +tn.f(y).toFixed(2), rain: Math.max(0, +rn.f(y).toFixed(0)) };
  });
  res.json({
    station: id, method: 'ordinary least squares on yearly Hadoop aggregates',
    trend: { tmaxPerDecade: +(tm.slope * 10).toFixed(2), tminPerDecade: +(tn.slope * 10).toFixed(2), rainPerDecade: +(rn.slope * 10).toFixed(0), r2: +tm.r2.toFixed(3) },
    history, forecast,
  });
});

// Raw CSV slice for the explorer (supports filters)
app.get('/api/hadoop/raw', (req, res) => {
  const { station, from, to } = req.query;
  const limit = Math.min(+req.query.limit || 100, 1000);
  let rows = H.rawRows();
  if (station) rows = rows.filter((r) => r.station === String(station).toUpperCase());
  if (from) rows = rows.filter((r) => r.date >= from);
  if (to) rows = rows.filter((r) => r.date <= to);
  res.json({ total: rows.length, rows: rows.slice(+req.query.offset || 0, (+req.query.offset || 0) + limit) });
});


// ---------- map tiles (proxied so the API key stays server-side) ----------
const LAYERS = new Set(['clouds_new', 'precipitation_new', 'temp_new', 'wind_new', 'pressure_new']);
const tileCache = new Map();
app.get('/api/tiles/:layer/:z/:x/:y.png', wrap(async (req, res) => {
  const { layer, z, x, y } = req.params;
  if (!LAYERS.has(layer) || ![z, x, y].every((n) => /^\d+$/.test(n))) return res.status(400).end();
  if (!KEY) return res.status(500).json({ error: 'OPENWEATHER_API_KEY missing in backend/.env' });
  const url = `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${KEY}`;
  let hit = tileCache.get(url);
  if (!hit || hit.exp < Date.now()) {
    const r = await fetch(url);
    if (!r.ok) { console.error(`tile ${layer} ${z}/${x}/${y} -> ${r.status}`); return res.status(r.status).end(); }
    hit = { buf: Buffer.from(await r.arrayBuffer()), exp: Date.now() + 600000 };
    if (tileCache.size > 800) tileCache.clear();
    tileCache.set(url, hit);
  }
  res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=600' }).send(hit.buf);
}));

// ---------- world board ----------
const WORLD = [
  ['London', 51.5074, -0.1278], ['New York', 40.7128, -74.006], ['Los Angeles', 34.0522, -118.2437], ['Mexico City', 19.4326, -99.1332],
  ['São Paulo', -23.5505, -46.6333], ['Buenos Aires', -34.6037, -58.3816], ['Lagos', 6.5244, 3.3792], ['Cairo', 30.0444, 31.2357],
  ['Nairobi', -1.2921, 36.8219], ['Cape Town', -33.9249, 18.4241], ['Moscow', 55.7558, 37.6173], ['Paris', 48.8566, 2.3522],
  ['Istanbul', 41.0082, 28.9784], ['Dubai', 25.2048, 55.2708], ['Delhi', 28.6139, 77.209], ['Mumbai', 19.076, 72.8777],
  ['Bangkok', 13.7563, 100.5018], ['Singapore', 1.3521, 103.8198], ['Beijing', 39.9042, 116.4074], ['Tokyo', 35.6762, 139.6503],
  ['Seoul', 37.5665, 126.978], ['Sydney', -33.8688, 151.2093], ['Jakarta', -6.2088, 106.8456], ['Reykjavik', 64.1466, -21.9426],
  ['Toronto', 43.6532, -79.3832], ['Anchorage', 61.2181, -149.9003],
];
app.get('/api/live/world', wrap(async (_req, res) => {
  const out = await Promise.all(WORLD.map(async ([name, lat, lon]) => {
    try {
      const w = await owm('/data/2.5/weather', { lat, lon }, 900);
      return { name, lat, lon, temp: w.main.temp, humidity: w.main.humidity, wind: w.wind.speed, icon: w.weather[0].icon, main: w.weather[0].main, country: w.sys.country };
    } catch { return null; }
  }));
  res.json(out.filter(Boolean));
}));

// ---------- smart alerts derived from current + forecast + air quality ----------
app.get('/api/live/alerts', wrap(async (req, res) => {
  const loc = await resolveLoc(req.query);
  const [w, f, a] = await Promise.all([
    owm('/data/2.5/weather', { lat: loc.lat, lon: loc.lon }),
    owm('/data/2.5/forecast', { lat: loc.lat, lon: loc.lon }),
    owm('/data/2.5/air_pollution', { lat: loc.lat, lon: loc.lon }, 900).catch(() => null),
  ]);
  const alerts = [];
  const hi = heatIndexC(w.main.temp, w.main.humidity);
  if (hi >= 41) alerts.push({ level: 'severe', icon: '🔥', title: 'Dangerous heat', text: `Heat index ${hi.toFixed(0)}°C — avoid outdoor activity, hydrate.` });
  else if (hi >= 32) alerts.push({ level: 'warn', icon: '🌡️', title: 'Hot conditions', text: `Feels like ${hi.toFixed(0)}°C — take breaks in the shade.` });
  if (w.main.temp <= 3) alerts.push({ level: 'warn', icon: '🥶', title: 'Near-freezing', text: `${w.main.temp.toFixed(0)}°C — dress warmly, watch for ice.` });
  if (w.wind.speed * 3.6 >= 40) alerts.push({ level: 'warn', icon: '💨', title: 'Strong wind', text: `${(w.wind.speed * 3.6).toFixed(0)} km/h gusty conditions.` });
  if (w.weather[0].main === 'Thunderstorm') alerts.push({ level: 'severe', icon: '⛈️', title: 'Thunderstorm', text: 'Stay indoors and away from open areas.' });
  const rain24 = f.list.slice(0, 8).reduce((s, x) => s + (x.rain?.['3h'] || 0), 0);
  if (rain24 >= 50) alerts.push({ level: 'severe', icon: '🌊', title: 'Heavy rain expected', text: `~${rain24.toFixed(0)} mm in the next 24 h (matches the heavy-rain rule ≥ 50 mm).` });
  else if (rain24 >= 10) alerts.push({ level: 'info', icon: '☔', title: 'Rain likely', text: `~${rain24.toFixed(0)} mm in the next 24 h — carry an umbrella.` });
  const maxNext = Math.max(...f.list.slice(0, 8).map((x) => x.main.temp_max));
  if (maxNext >= 35) alerts.push({ level: 'warn', icon: '☀️', title: 'Heat-event day ahead', text: `Forecast high ${maxNext.toFixed(0)}°C (≥ 35°C rule).` });
  const aqi = a?.list?.[0]?.main.aqi;
  if (aqi >= 4) alerts.push({ level: 'severe', icon: '😷', title: 'Poor air quality', text: 'AQI is poor — limit outdoor exertion, consider a mask.' });
  else if (aqi === 3) alerts.push({ level: 'info', icon: '🌫️', title: 'Moderate air quality', text: 'Sensitive groups should reduce prolonged exertion.' });
  res.json({ location: w.name, alerts });
}));

app.get('/api/health', (_req, res) => res.json({ ok: true, keyConfigured: !!KEY, time: new Date().toISOString() }));

app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(err.status || 500).json({ error: err.message });
});

app.listen(PORT, () => console.log(`Weather API on http://localhost:${PORT}`));
startHdfsSync();
