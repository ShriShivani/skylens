import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { iconUrl, title, useApi } from '../api';
import { Card, Data, Page } from '../components/ui.jsx';
import { usePrefs, useTheme } from '../components/prefs.jsx';

const VIEWS = { india: { center: [22.5, 80], zoom: 5 }, world: { center: [22, 15], zoom: 2 } };
const OVERLAYS = [
  [null, 'None'], ['temp_new', '🌡️ Temperature'], ['precipitation_new', '🌧️ Rain'], ['clouds_new', '☁️ Clouds'], ['wind_new', '💨 Wind'], ['pressure_new', '🧭 Pressure'],
];
const METRICS = {
  live: { label: 'Live temp now', unit: '°C', lo: -5, hi: 42 },
  tmax: { label: 'Avg max (Hadoop)', unit: '°C', lo: 26, hi: 37 },
  rain: { label: 'Annual rain (Hadoop)', unit: ' mm', lo: 300, hi: 3500 },
  humidity: { label: 'Humidity (Hadoop)', unit: '%', lo: 45, hi: 80 },
  wind: { label: 'Wind (Hadoop)', unit: ' km/h', lo: 8, hi: 18 },
};
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const esri = (name) => `${ESRI}/${name}/MapServer/tile/{z}/{y}/{x}`;
// All key-free providers (CARTO's basemaps now require an API key).
const STYLES = {
  clean: ['🗺️ Clean', (th) => [esri(`Canvas/World_${th === 'day' ? 'Light' : 'Dark'}_Gray_Base`), esri(`Canvas/World_${th === 'day' ? 'Light' : 'Dark'}_Gray_Reference`)]],
  osm: ['🛣️ Streets', () => ['https://tile.openstreetmap.org/{z}/{x}/{y}.png']],
  sat: ['🛰️ Satellite', () => [esri('World_Imagery'), esri('Reference/World_Boundaries_and_Places')]],
  topo: ['⛰️ Terrain', () => [esri('World_Topo_Map')]],
};
const ATTR = { clean: 'Tiles &copy; Esri', osm: '&copy; OpenStreetMap contributors', sat: 'Tiles &copy; Esri, Maxar, Earthstar Geographics', topo: 'Tiles &copy; Esri' };
const SCALE_T = 'linear-gradient(90deg,#3b82f6,#38bdf8,#34d399,#fbbf24,#f97316,#fb7185)';

const colorOf = (v, m, key) => {
  if (v == null) return '#64748b';
  const t = Math.max(0, Math.min(1, (v - m.lo) / (m.hi - m.lo)));
  if (key === 'humidity') return `hsl(${45 + t * 160}, 85%, ${68 - t * 20}%)`;
  if (key === 'wind') return `hsl(${280 - t * 40}, ${60 + t * 30}%, ${75 - t * 30}%)`;
  return key === 'rain' ? `hsl(${205 - t * 15}, 90%, ${78 - t * 42}%)` : `hsl(${220 - t * 215}, 92%, 62%)`;
};

const markerIcon = (text, color, label, sel) => L.divIcon({
  className: `wm ${sel ? 'sel' : ''}`, iconSize: [38, 38], iconAnchor: [19, 19],
  html: `<div class="dot" style="background:${color};color:${color}"><span style="color:#04142b">${text}</span></div>${label ? `<span class="lbl">${label}</span>` : ''}`,
});

function Fly({ region }) {
  const map = useMap();
  useEffect(() => { map.flyTo(VIEWS[region].center, VIEWS[region].zoom, { duration: 1.4 }); }, [region, map]);
  return null;
}
function Picker({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: +e.latlng.lat.toFixed(3), lon: +e.latlng.lng.toFixed(3), custom: true }) });
  return null;
}

export default function MapView() {
  const { t, deg } = usePrefs();
  const theme = useTheme();
  const [region, setRegion] = useState('india');
  const [metric, setMetric] = useState('live');
  const [overlay, setOverlay] = useState('temp_new');
  const [pick, setPick] = useState(null);
  const [style, setStyle] = useState('clean');
  const health = useApi('/health');

  const live = useApi('/live/stations', 600000);
  const lb = useApi('/hadoop/leaderboard');
  const world = useApi(region === 'world' ? '/live/world' : null, 900000);

  const stations = useMemo(() => (live.data && lb.data
    ? live.data.map((s) => ({ ...s, ...lb.data.find((x) => x.station === s.id), liveTemp: s.error ? null : s.temp })) : []), [live.data, lb.data]);
  const m = METRICS[region === 'world' ? 'live' : metric];
  const mk = region === 'world' ? 'live' : metric;

  const points = region === 'world'
    ? (world.data || []).map((c) => ({ id: c.name, name: c.name, lat: c.lat, lon: c.lon, v: c.temp, kind: 'city' }))
    : stations.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, v: mk === 'live' ? s.liveTemp : mk === 'tmax' ? s.avgTmax : mk === 'rain' ? s.annualRain : mk === 'humidity' ? s.avgHumidity : s.avgWind, kind: 'station', st: s }));

  const q = pick ? (pick.custom || pick.kind === 'city' ? `lat=${pick.lat}&lon=${pick.lon}` : `station=${pick.id}`) : null;
  const detail = useApi(q ? `/live/current?${q}` : null);
  const picked = pick?.st || null;
  const fmt = (v) => (mk === 'live' ? t(v) : Math.round(v));
  const base = style;
  const tileUrls = STYLES[base][1](theme);

  return (
    <Page title="Weather Map" sub="A real interactive map: pan, zoom, click anywhere on Earth for live weather, and layer OpenWeather radar-style overlays.">
      <div className="controls" style={{ marginBottom: 14, justifyContent: 'space-between' }}>
        <div className="chips">
          {['india', 'world'].map((r) => <button key={r} className={`chip ${region === r ? 'on' : ''}`} onClick={() => { setRegion(r); setPick(null); }}>{r === 'india' ? '🇮🇳 India · Hadoop stations' : '🌍 World cities'}</button>)}
        </div>
        {region === 'india' && (
          <div className="chips">{Object.entries(METRICS).map(([k, v]) => <button key={k} className={`chip ${metric === k ? 'on' : ''}`} onClick={() => setMetric(k)}>{v.label}</button>)}</div>
        )}
      </div>
      {health.data && !health.data.keyConfigured && <div className="err" style={{ marginBottom: 14 }}>⚠ The API has no OpenWeather key. Put OPENWEATHER_API_KEY in backend/.env and restart the backend.</div>}
      {health.error && <div className="err" style={{ marginBottom: 14 }}>⚠ Cannot reach the API on port 5000 — start the backend (see README).</div>}
      <div className="chips" style={{ marginBottom: 14 }}>
        <span style={{ color: 'var(--muted)', alignSelf: 'center', fontSize: 13 }}>Map:</span>
        {Object.entries(STYLES).map(([k, [l]]) => <button key={k} className={`chip ${style === k ? 'on' : ''}`} onClick={() => setStyle(k)}>{l}</button>)}
      </div>
      <div className="chips" style={{ marginBottom: 14 }}>
        <span style={{ color: 'var(--muted)', alignSelf: 'center', fontSize: 13 }}>Overlay:</span>
        {OVERLAYS.map(([k, l]) => <button key={l} className={`chip ${overlay === k ? 'on' : ''}`} onClick={() => setOverlay(k)}>{l}</button>)}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(320px, 2fr) minmax(280px, 1fr)' }}>
        <Card i={1} style={{ padding: 6 }}>
          <div className="mapbox">
            <MapContainer center={VIEWS.india.center} zoom={VIEWS.india.zoom} minZoom={2} worldCopyJump scrollWheelZoom>
              {tileUrls.map((u, i) => <TileLayer key={`${base}-${theme}-${i}`} url={u} attribution={i === 0 ? ATTR[base] : ''} maxZoom={base === 'osm' ? 19 : 16} />)}
              {overlay && <TileLayer key={overlay} url={`/api/tiles/${overlay}/{z}/{x}/{y}.png`} opacity={0.5} attribution="Weather &copy; OpenWeather" />}
              <Fly region={region} />
              <Picker onPick={setPick} />
              {points.map((p) => p.v != null && (
                <Marker key={`${region}-${p.id}`} position={[p.lat, p.lon]} icon={markerIcon(fmt(p.v), colorOf(p.v, m, mk), p.name, pick?.id === p.id)}
                  eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); setPick({ ...p, custom: false }); } }} />
              ))}
              {pick?.custom && <Marker position={[pick.lat, pick.lon]} icon={markerIcon('📍', '#fbbf24', '', true)} />}
            </MapContainer>
            <div className="pickhint">Click anywhere for live weather</div>
            <div className="maplegend">
              {m.label} · {mk === 'live' ? deg : m.unit.trim()}
              <i style={{ background: mk === 'rain' ? 'linear-gradient(90deg,hsl(205,90%,78%),hsl(190,90%,36%))' : mk === 'humidity' ? 'linear-gradient(90deg,hsl(45,85%,68%),hsl(205,85%,48%))' : mk === 'wind' ? 'linear-gradient(90deg,hsl(280,60%,75%),hsl(240,90%,45%))' : SCALE_T }} />
              <div><span>{mk === 'live' ? t(m.lo) : m.lo}</span><span>{mk === 'live' ? t(m.hi) : m.hi}</span></div>
            </div>
          </div>
        </Card>

        <div className="grid" style={{ alignContent: 'start' }}>
          <Card className="glow" title={pick ? (pick.custom ? `Pinned ${pick.lat}, ${pick.lon}` : pick.name) : 'Select a place'} i={2}>
            {!pick && <p style={{ color: 'var(--muted)' }}>Tap a bubble or click anywhere on the map — the ocean, a village, another continent.</p>}
            {pick && <Data state={detail}>{(w) => (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <img src={iconUrl(w.weather[0].icon)} width="84" alt="" />
                  <div>
                    <div style={{ fontSize: 46, fontWeight: 800 }}>{t(w.main.temp)}°</div>
                    <div style={{ color: 'var(--muted)', textTransform: 'capitalize' }}>{w.weather[0].description}{w.name ? ` · ${w.name}, ${w.sys.country || ''}` : ''}</div>
                  </div>
                </div>
                <div className="kv">
                  <div><b>{t(w.main.feels_like)}°</b><span>Feels like</span></div>
                  <div><b>{w.main.humidity}%</b><span>Humidity</span></div>
                  <div><b>{(w.wind.speed * 3.6).toFixed(0)} km/h</b><span>Wind</span></div>
                  <div><b>{w.clouds.all}%</b><span>Cloud cover</span></div>
                </div>
              </>
            )}</Data>}
            {picked && (
              <div className="kv">
                <div><b>{t(picked.avgTmax, 1)}°</b><span>Avg max · 15 yr</span></div>
                <div><b>{t(picked.avgTmin, 1)}°</b><span>Avg min · 15 yr</span></div>
                <div><b>{t(picked.peak, 1)}°</b><span>Record high</span></div>
                <div><b>{picked.annualRain} mm</b><span>Annual rain</span></div>
                <div><b>{picked.avgHumidity}%</b><span>Avg humidity</span></div>
                <div><b>{picked.avgWind} km/h</b><span>Avg wind</span></div>
              </div>
            )}
          </Card>
          <Card title={`Ranking · ${m.label}`} i={3}>
            <div style={{ maxHeight: 340, overflow: 'auto' }}>
              {[...points].filter((p) => p.v != null).sort((a, b) => b.v - a.v).map((p) => (
                <div key={p.id} onClick={() => setPick({ ...p, custom: false })} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 56px', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
                  <small>{title(p.name)}</small>
                  <div className="range"><i style={{ left: 0, right: `${100 - Math.max(5, ((p.v - m.lo) / (m.hi - m.lo)) * 100)}%`, background: colorOf(p.v, m, mk) }} /></div>
                  <small style={{ textAlign: 'right' }}>{fmt(p.v)}{mk === 'live' ? '°' : m.unit}</small>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
