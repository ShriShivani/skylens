import { useEffect, useState } from 'react';
import { title, useApi, useStations } from '../api';
import { Card, Data, Page, StationSelect, downloadCsv } from '../components/ui.jsx';

const SETS = { raw: 'Raw CSV (input)', temperature: 'Temperature output', rainfall: 'Rainfall output', atmosphere: 'Humidity & wind output', extremes: 'Extremes output' };

export default function Explorer() {
  const stations = useStations();
  const [set, setSet] = useState('temperature');
  const [st, setSt] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [set, st]);

  const path = set === 'raw' ? `/hadoop/raw?limit=100&offset=${page * 100}${st ? `&station=${st}` : ''}`
    : set === 'extremes' ? `/hadoop/extremes?limit=100&offset=${page * 100}${st ? `&station=${st}` : ''}`
    : `/hadoop/${set}${st ? `?station=${st}` : ''}`;
  const res = useApi(path);

  return (
    <Page title="Data Explorer" sub="Inspect the raw dataset and every MapReduce output. Search, filter, page and export.">
      <Card i={1}>
        <div className="controls">
          {Object.entries(SETS).map(([k, v]) => <button key={k} className={`chip ${set === k ? 'on' : ''}`} onClick={() => setSet(k)}>{v}</button>)}
          <StationSelect all stations={stations} value={st} onChange={setSt} />
          <input type="search" placeholder="Filter rows…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>
      <div style={{ height: 18 }} />
      <Data state={res}>{(d) => {
        const all = Array.isArray(d) ? d : d.rows;
        const total = Array.isArray(d) ? d.length : d.total;
        const cols = all[0] ? Object.keys(all[0]) : [];
        const rows = (q ? all.filter((r) => JSON.stringify(r).toLowerCase().includes(q.toLowerCase())) : all).slice(0, Array.isArray(d) ? 300 : 100);
        const paged = !Array.isArray(d);
        return (
          <Card i={2}>
            <div className="controls" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <small style={{ color: 'var(--muted)' }}>{total.toLocaleString()} rows{!paged && total > 300 ? ' · showing first 300' : ''}</small>
              <button className="btn ghost" onClick={() => downloadCsv(`${set}.csv`, all)}>⬇ Download CSV</button>
            </div>
            <div className="scroll"><table>
              <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className={c === 'date' ? 'mono' : ''}>{c === 'station' ? title(r[c]) : String(r[c])}</td>)}</tr>)}</tbody>
            </table></div>
            {paged && (
              <div className="controls" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
                <button className="btn ghost" disabled={!page} onClick={() => setPage(page - 1)}>← Prev</button>
                <button className="btn ghost" disabled={(page + 1) * 100 >= total} onClick={() => setPage(page + 1)}>Next →</button>
              </div>
            )}
          </Card>
        );
      }}</Data>
    </Page>
  );
}
