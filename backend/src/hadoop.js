import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const RESULTS = path.join(ROOT, 'results');
export const CSV = path.join(ROOT, 'data', 'weather.csv');

const kv = (s) =>
  Object.fromEntries(
    s.split(',').map((p) => {
      const i = p.indexOf('=');
      return i < 0 ? ['type', p] : [p.slice(0, i), p.slice(i + 1)];
    }),
  );
const num = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, isNaN(+v) ? v : +v]));

function readTsv(name) {
  const f = path.join(RESULTS, `${name}.tsv`);
  if (!fs.existsSync(f)) return null;
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t'));
}

let cache = {};
const mtime = (n) => {
  try { return fs.statSync(path.join(RESULTS, `${n}.tsv`)).mtimeMs; } catch { return 0; }
};

export function temperature() {
  const m = mtime('temperature');
  if (cache.t?.m === m) return cache.t.v;
  const rows = (readTsv('temperature') || []).map(([k, v]) => {
    const i = k.lastIndexOf('-');
    return { station: k.slice(0, i), year: +k.slice(i + 1), ...num(kv(v)) };
  });
  cache.t = { m, v: rows };
  return rows;
}

export function rainfall() {
  const m = mtime('rainfall');
  if (cache.r?.m === m) return cache.r.v;
  const rows = (readTsv('rainfall') || []).map(([k, v]) => {
    const [station, year, month] = k.split('-');
    return { station, year: +year, month: +month, ...num(kv(v)) };
  });
  cache.r = { m, v: rows };
  return rows;
}

export function atmosphere() {
  const m = mtime('atmosphere');
  if (cache.a?.m === m) return cache.a.v;
  const rows = (readTsv('atmosphere') || []).map(([k, v]) => {
    const [station, year, month] = k.split('-');
    return { station, year: +year, month: +month, ...num(kv(v)) };
  });
  cache.a = { m, v: rows };
  return rows;
}

export function extremes() {
  const m = mtime('extremes');
  if (cache.e?.m === m) return cache.e.v;
  const rows = (readTsv('extremes') || []).map(([k, v]) => {
    const date = k.slice(0, 10);
    const o = num(kv(v));
    return { date, year: +date.slice(0, 4), month: +date.slice(5, 7), station: k.slice(11), ...o };
  });
  cache.e = { m, v: rows };
  return rows;
}

// Raw CSV (for configurable-threshold recomputation), parsed once.
let raw = null;
export function rawRows() {
  if (raw) return raw;
  if (!fs.existsSync(CSV)) return (raw = []);
  const lines = fs.readFileSync(CSV, 'utf8').split('\n');
  raw = [];
  for (let i = 1; i < lines.length; i++) {
    const f = lines[i].trim().split(',');
    if (f.length !== 5 && f.length !== 7) continue;
    raw.push({ date: f[0], station: f[1], tmax: +f[2], tmin: +f[3], prcp: +f[4], humidity: f[5] === undefined ? null : +f[5], wind: f[6] === undefined ? null : +f[6] });
  }
  return raw;
}

export function pipelineStatus() {
  const info = (n) => {
    const f = path.join(RESULTS, `${n}.tsv`);
    if (!fs.existsSync(f)) return { name: n, exists: false };
    const st = fs.statSync(f);
    return { name: n, exists: true, bytes: st.size, modified: st.mtime, rows: readTsv(n).length };
  };
  const csv = fs.existsSync(CSV) ? fs.statSync(CSV) : null;
  return {
    input: csv ? { exists: true, bytes: csv.size, rows: rawRows().length } : { exists: false },
    outputs: ['temperature', 'rainfall', 'extremes', 'atmosphere'].map(info),
  };
}

// Ordinary least squares y = a + b x
export function linreg(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  const b = sxx ? sxy / sxx : 0;
  return { slope: b, intercept: my - b * mx, r2: sxx && syy ? (sxy * sxy) / (sxx * syy) : 0 };
}
