import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

const SLA = { critical: '4 hours', high: '8 hours', medium: '24 hours', low: '72 hours' };

export default function NewTicket() {
  const nav = useNavigate();
  const [f, setF] = useState({ title: '', description: '', category: 'general', priority: 'medium' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    try { const t = await api('/tickets', { method: 'POST', body: f }); nav(`/tickets/${t.id}`); }
    catch (e) { setErr(e.message); }
  }

  return (
    <form className="panel form" onSubmit={submit}>
      <h1>New ticket</h1>
      <label>Title<input value={f.title} onChange={set('title')} maxLength={200} required /></label>
      <label>What happened?
        <textarea rows={6} value={f.description} onChange={set('description')} required />
      </label>
      <div className="row">
        <label>Category
          <select value={f.category} onChange={set('category')}>
            {['general', 'network', 'hardware', 'software', 'access'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>Priority
          <select value={f.priority} onChange={set('priority')}>
            {Object.keys(SLA).reverse().map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
      </div>
      <p className="hint">Target resolution for {f.priority} priority: {SLA[f.priority]}. Unresolved tickets are escalated automatically.</p>
      {err && <p className="err">{err}</p>}
      <button className="btn">Submit ticket</button>
    </form>
  );
}
