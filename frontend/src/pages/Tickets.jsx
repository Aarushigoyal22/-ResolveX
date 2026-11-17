import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { PriorityBadge, StatusBadge, SlaMeter } from '../components.jsx';

export default function Tickets() {
  const { user } = useAuth();
  const staff = user.role !== 'user';
  const [filters, setFilters] = useState({ q: '', status: '', priority: '', overdue: false, mine: false });
  const [page, setPage] = useState(1);
  const [res, setRes] = useState({ data: [], total: 0, limit: 15 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {       // debounce typing in the search box
      const p = new URLSearchParams({ page, limit: 15 });
      if (filters.q) p.set('q', filters.q);
      if (filters.status) p.set('status', filters.status);
      if (filters.priority) p.set('priority', filters.priority);
      if (filters.overdue) p.set('overdue', 'true');
      if (filters.mine) p.set('assigned_to', 'me');
      setLoading(true);
      try { setRes(await api(`/tickets?${p}`)); } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [filters, page]);

  const set = (k, v) => { setFilters({ ...filters, [k]: v }); setPage(1); };
  const pages = Math.max(1, Math.ceil(res.total / res.limit));

  return (
    <>
      <header className="head">
        <h1>{staff ? 'All tickets' : 'My tickets'} <small>{res.total}</small></h1>
        <Link className="btn" to="/tickets/new">New ticket</Link>
      </header>

      <div className="filters">
        <input placeholder="Search titles" value={filters.q} onChange={(e) => set('q', e.target.value)} />
        <select value={filters.status} onChange={(e) => set('status', e.target.value)}>
          <option value="">Any status</option>
          {['open', 'assigned', 'in_progress', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={filters.priority} onChange={(e) => set('priority', e.target.value)}>
          <option value="">Any priority</option>
          {['critical', 'high', 'medium', 'low'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={filters.overdue} onChange={(e) => set('overdue', e.target.checked)} /> Overdue only</label>
        {staff && <label className="check"><input type="checkbox" checked={filters.mine} onChange={(e) => set('mine', e.target.checked)} /> Assigned to me</label>}
      </div>

      <div className="panel flush">
        <table>
          <thead><tr><th>ID</th><th>Title</th><th>Priority</th><th>Status</th><th>Assignee</th><th>SLA</th></tr></thead>
          <tbody>
            {res.data.map((t) => (
              <tr key={t.id} className={t.is_overdue ? 'overdue' : ''}>
                <td className="mono">#{t.id}</td>
                <td><Link to={`/tickets/${t.id}`}>{t.title}</Link>
                  {t.escalation_level > 0 && <span className="esc" title="Escalated by SLA monitor">escalated ×{t.escalation_level}</span>}
                  <div className="sub">{t.category} · by {t.created_by_name}</div></td>
                <td><PriorityBadge value={t.priority} /></td>
                <td><StatusBadge value={t.status} /></td>
                <td>{t.assigned_to_name || <span className="sub">Unassigned</span>}</td>
                <td><SlaMeter ticket={t} /></td>
              </tr>
            ))}
            {!loading && !res.data.length && (
              <tr><td colSpan={6} className="empty">No tickets match these filters. Clear a filter or create a new ticket.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <button className="btn ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {pages}</span>
        <button className="btn ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </>
  );
}
