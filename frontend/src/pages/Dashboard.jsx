import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';

const PRIORITY_COLORS = { low: '#5B8A72', medium: '#3B6EA8', high: '#D9822B', critical: '#C2362F' };
const STATUS_COLORS = { open: '#8A97A6', assigned: '#3B6EA8', in_progress: '#0E7C7B', resolved: '#5B8A72', closed: '#B8C1CC' };

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('/analytics/summary').then(setD).catch((e) => setErr(e.message)); }, []);

  if (err) return <p className="err">{err}</p>;
  if (!d) return <p>Loading…</p>;
  const k = d.kpi;

  return (
    <>
      <header className="head"><h1>Dashboard</h1></header>

      <div className="kpis">
        <div><span>Active tickets</span><b>{k.active}</b></div>
        <Link to="/tickets" className={k.overdue ? 'kpi-bad' : ''}><span>Overdue</span><b>{k.overdue}</b></Link>
        <div><span>SLA compliance</span><b>{k.sla_compliance_pct ?? '–'}{k.sla_compliance_pct != null && '%'}</b></div>
        <div><span>Avg. resolution</span><b>{k.avg_resolution_hours ?? '–'}{k.avg_resolution_hours != null && 'h'}</b></div>
        <div><span>All-time total</span><b>{k.total}</b></div>
      </div>

      <div className="grid">
        <section className="panel wide">
          <h3>Created vs resolved, last 14 days</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={d.trend}>
              <CartesianGrid stroke="#E3E8ED" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} interval={1} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip /><Legend />
              <Line dataKey="created" stroke="#3B6EA8" strokeWidth={2} dot={false} />
              <Line dataKey="resolved" stroke="#0E7C7B" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section className="panel">
          <h3>By status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={d.byStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {d.byStatus.map((s) => <Cell key={s.name} fill={STATUS_COLORS[s.name]} />)}
              </Pie>
              <Tooltip /><Legend formatter={(v) => v.replace('_', ' ')} />
            </PieChart>
          </ResponsiveContainer>
        </section>

        <section className="panel">
          <h3>By priority</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.byPriority}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} /><Tooltip />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {d.byPriority.map((p) => <Cell key={p.name} fill={PRIORITY_COLORS[p.name]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="panel wide">
          <h3>Team performance</h3>
          <table>
            <thead><tr><th>Agent</th><th>Active now</th><th>Resolved</th><th>Avg. resolution</th><th>Met SLA</th></tr></thead>
            <tbody>
              {d.agents.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td><td>{a.active}</td><td>{a.resolved}</td>
                  <td className="mono">{a.avg_hours ?? '–'}{a.avg_hours != null && 'h'}</td>
                  <td className="mono">{a.sla_pct ?? '–'}{a.sla_pct != null && '%'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
