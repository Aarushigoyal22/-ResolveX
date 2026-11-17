import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { PriorityBadge, StatusBadge, SlaMeter } from '../components.jsx';

const NEXT = {
  open: [], assigned: [['in_progress', 'Start work']],
  in_progress: [['resolved', 'Mark resolved']],
  resolved: [['closed', 'Close ticket'], ['in_progress', 'Reopen']], closed: [],
};

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [t, setT] = useState(null);
  const [agents, setAgents] = useState([]);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(() => api(`/tickets/${id}`).then(setT).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (user.role === 'admin') api('/users/agents').then(setAgents); }, [user.role]);

  const act = (fn) => async (...a) => { setErr(''); try { await fn(...a); await load(); } catch (e) { setErr(e.message); } };
  const setStatus = act((status) => api(`/tickets/${id}/status`, { method: 'PATCH', body: { status } }));
  const assign = act((agent_id) => api(`/tickets/${id}/assign`, { method: 'PATCH', body: { agent_id: Number(agent_id) } }));
  const addComment = act(async (e) => {
    e.preventDefault();
    await api(`/tickets/${id}/comments`, { method: 'POST', body: { body: comment } });
    setComment('');
  });

  if (err && !t) return <p className="err">{err}</p>;
  if (!t) return <p>Loading…</p>;
  const canAct = user.role === 'admin' || (user.role === 'agent' && t.assigned_to === user.id);

  return (
    <div className="detail">
      <section>
        <header className="head">
          <h1><span className="mono">#{t.id}</span> {t.title}</h1>
        </header>
        <div className="panel">
          <div className="chips"><PriorityBadge value={t.priority} /><StatusBadge value={t.status} />
            {t.escalation_level > 0 && <span className="esc">escalated ×{t.escalation_level}</span>}</div>
          <p className="desc">{t.description}</p>
          <SlaMeter ticket={t} />
          {err && <p className="err">{err}</p>}
          {canAct && NEXT[t.status].length > 0 && (
            <div className="actions">
              {NEXT[t.status].map(([s, text]) => <button key={s} className="btn" onClick={() => setStatus(s)}>{text}</button>)}
            </div>
          )}
        </div>

        <h3>Conversation</h3>
        <div className="panel">
          {t.comments.length === 0 && <p className="sub">No comments yet. Add context or updates below.</p>}
          {t.comments.map((c) => (
            <div key={c.id} className="comment"><b>{c.author}</b> <span className="sub">{new Date(c.created_at).toLocaleString()}</span><p>{c.body}</p></div>
          ))}
          <form onSubmit={addComment} className="comment-form">
            <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment" required />
            <button className="btn">Post comment</button>
          </form>
        </div>
      </section>

      <aside>
        <div className="panel">
          <dl>
            <dt>Requester</dt><dd>{t.created_by_name}</dd>
            <dt>Assignee</dt><dd>{t.assigned_to_name || 'Unassigned'}</dd>
            <dt>Category</dt><dd>{t.category}</dd>
            <dt>Created</dt><dd>{new Date(t.created_at).toLocaleString()}</dd>
            <dt>SLA due</dt><dd>{new Date(t.sla_due_at).toLocaleString()}</dd>
          </dl>
          {user.role === 'admin' && !['resolved', 'closed'].includes(t.status) && (
            <label>Reassign
              <select value={t.assigned_to || ''} onChange={(e) => assign(e.target.value)}>
                <option value="" disabled>Choose agent</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.active_tickets} active){a.is_available ? '' : ' · away'}</option>)}
              </select>
            </label>
          )}
        </div>
        <h3>Activity</h3>
        <ol className="timeline">
          {t.history.map((h) => (
            <li key={h.id}><b>{h.actor || 'System'}</b> {h.detail}<div className="sub">{new Date(h.created_at).toLocaleString()}</div></li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
