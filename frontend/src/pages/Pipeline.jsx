import { motion } from 'framer-motion';
import { useApi } from '../api';
import { Card, Data, Page } from '../components/ui.jsx';

const STEPS = [
  ['📄', 'weather.csv', '109,580 daily rows · 7 columns'],
  ['🗄️', 'HDFS', '/weather/input'],
  ['🧵', 'YARN', 'schedules 3 jobs'],
  ['🗺️', 'Mapper → Shuffle → Reducer', 'Java MapReduce'],
  ['📦', 'TSV results', 'hdfs dfs -getmerge'],
  ['🟢', 'Express API', 'Node.js · :5000'],
  ['⚛️', 'React UI', 'Vite · :5173'],
];
const fmt = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${(b / 1e3).toFixed(1)} KB`);

export default function Pipeline() {
  const st = useApi('/hadoop/status', 15000);
  const health = useApi('/health');
  return (
    <Page title="Pipeline & About" sub="Hadoop does the heavy lifting; Express serves it; React brings it to life.">
      <Card title="Data flow" i={1}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          {STEPS.map(([ic, t, s], i) => (
            <motion.div key={t} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.12 }} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="hr" style={{ width: 150, padding: 14 }}>
                <div style={{ fontSize: 28 }}>{ic}</div><b style={{ fontSize: 14 }}>{t}</b><small>{s}</small>
              </div>
              {i < STEPS.length - 1 && <motion.span animate={{ x: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.6, delay: i * 0.2 }} style={{ color: 'var(--sun)', fontSize: 22 }}>➜</motion.span>}
            </motion.div>
          ))}
        </div>
      </Card>
      <div style={{ height: 18 }} />
      <div className="grid g2">
        <Card title="Live system status" i={2}>
          <Data state={st} skeleton={<div className="skeleton" />}>{(s) => (
            <table><tbody>
              <tr><td>Input CSV</td><td>{s.input.exists ? <span className="badge ok">{s.input.rows.toLocaleString()} rows · {fmt(s.input.bytes)}</span> : <span className="badge heat">missing</span>}</td></tr>
              {s.outputs.map((o) => <tr key={o.name}><td className="mono">results/{o.name}.tsv</td><td>{o.exists ? <span className="badge ok">{o.rows.toLocaleString()} rows · {fmt(o.bytes)}</span> : <span className="badge heat">not exported</span>}</td></tr>)}
              <tr><td>HDFS (WebHDFS sync)</td><td>{s.hdfs?.connected ? <span className="badge ok">connected · synced {new Date(s.hdfs.lastSync).toLocaleTimeString()}</span> : <span className="badge warn">offline — serving exported TSVs ({s.hdfs?.lastError || 'n/a'})</span>}</td></tr>
              <tr><td>OpenWeather key</td><td>{health.data?.keyConfigured ? <span className="badge ok">configured (server-side)</span> : <span className="badge heat">missing</span>}</td></tr>
            </tbody></table>
          )}</Data>
        </Card>
        <Card title="The four MapReduce jobs" i={3}>
          <p><b>1 · Temperature</b> — key <code className="mono">STATION-YEAR</code> → avg/min/max/count.</p>
          <p style={{ marginTop: 8 }}><b>2 · Rainfall</b> — key <code className="mono">STATION-YYYY-MM</code> → total, rainy days (rain &gt; 0).</p>
          <p style={{ marginTop: 8 }}><b>3 · Extremes</b> — threshold filter with identity reducer; thresholds configurable (defaults 35 °C / 50 mm / 40 km/h).</p>
          <p style={{ marginTop: 8 }}><b>4 · Atmosphere</b> — key <code className="mono">STATION-YYYY-MM</code> → mean/min/max humidity, mean/peak wind.</p>
        </Card>
        <Card title="Limitations" i={4}>
          <ul style={{ paddingLeft: 18, lineHeight: 1.7, color: 'var(--muted)' }}>
            <li>Historical dataset is synthetic — for demonstration only.</li>
            <li>Hadoop is single-node on WSL 2; the code scales to a cluster unchanged.</li>
            <li>The API pulls results from HDFS via WebHDFS every 60 s and falls back to the exported TSVs if HDFS is down.</li>
            <li>Trend projections are simple regression, not weather prediction.</li>
            <li>Extreme-event thresholds are project rules, not official warnings.</li>
          </ul>
        </Card>
        <Card title="Tech stack" i={5}>
          <div className="chips">{['Hadoop 3.5', 'HDFS', 'YARN', 'Java 17', 'Node.js', 'Express', 'React 18', 'Vite', 'Recharts', 'Framer Motion', 'OpenWeather API'].map((t) => <span key={t} className="chip">{t}</span>)}</div>
        </Card>
      </div>
    </Page>
  );
}
