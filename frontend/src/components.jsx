export const label = (s) => s.replace('_', ' ');

export const PriorityBadge = ({ value }) => <span className={`pill p-${value}`}>{value}</span>;
export const StatusBadge = ({ value }) => <span className={`pill s-${value}`}>{label(value)}</span>;

/**
 * SLA meter: how much of the time window is used up.
 * Fills left to right, amber past 75%, red once breached.
 */
export function SlaMeter({ ticket }) {
  const done = ['resolved', 'closed'].includes(ticket.status);
  const start = new Date(ticket.created_at).getTime();
  const end = new Date(ticket.sla_due_at).getTime();
  const now = done && ticket.resolved_at ? new Date(ticket.resolved_at).getTime() : Date.now();
  const pct = Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
  const left = end - Date.now();
  const hrs = Math.abs(left) / 36e5;
  const text = done
    ? (new Date(ticket.resolved_at) <= new Date(ticket.sla_due_at) ? 'Met SLA' : 'Missed SLA')
    : left < 0 ? `${fmt(hrs)} overdue` : `${fmt(hrs)} left`;
  const tone = done ? 'ok' : left < 0 ? 'bad' : pct > 75 ? 'warn' : 'ok';
  return (
    <div className={`sla sla-${tone}`} title={`Due ${new Date(ticket.sla_due_at).toLocaleString()}`}>
      <div className="sla-track"><i style={{ width: `${done && tone === 'ok' ? 100 : pct}%` }} /></div>
      <span className="mono">{text}</span>
    </div>
  );
}
const fmt = (h) => (h >= 24 ? `${(h / 24).toFixed(1)}d` : h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(h * 60)}m`);
