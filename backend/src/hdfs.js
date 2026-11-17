import fs from 'node:fs';
import path from 'node:path';
import { RESULTS } from './hadoop.js';

// Pulls the MapReduce outputs straight from HDFS over WebHDFS (NameNode :9870) and
// refreshes results/*.tsv. If HDFS is down, the exported TSVs keep being served.
const NN = process.env.WEBHDFS_URL || 'http://localhost:9870';
const JOBS = ['temperature', 'rainfall', 'extremes', 'atmosphere'];
const state = { enabled: true, connected: false, lastSync: null, lastError: null, synced: [] };
export const hdfsState = () => ({ ...state, namenode: NN });

async function pull(job) {
  const dir = `${NN}/webhdfs/v1/weather/output/${job}`;
  const ls = await fetch(`${dir}?op=LISTSTATUS`, { signal: AbortSignal.timeout(4000) });
  if (!ls.ok) throw new Error(`${job}: ${ls.status}`);
  const files = (await ls.json()).FileStatuses.FileStatus.filter((f) => f.pathSuffix.startsWith('part-')).map((f) => f.pathSuffix).sort();
  const parts = [];
  for (const f of files) {
    const r = await fetch(`${dir}/${f}?op=OPEN`, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`${job}/${f}: ${r.status}`);
    parts.push(await r.text());
  }
  if (!parts.length) throw new Error(`${job}: no part files`);
  const target = path.join(RESULTS, `${job}.tsv`);
  const body = parts.join('');
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== body) fs.writeFileSync(target, body);
}

async function sync() {
  try {
    for (const j of JOBS) await pull(j);
    Object.assign(state, { connected: true, lastSync: new Date().toISOString(), lastError: null, synced: JOBS });
  } catch (e) {
    Object.assign(state, { connected: false, lastError: e.cause?.code || e.message });
  }
}

export function startHdfsSync(every = 60000) {
  if (process.env.WEBHDFS_URL === 'off') return (state.enabled = false);
  fs.mkdirSync(RESULTS, { recursive: true });
  sync();
  setInterval(sync, every).unref();
}
