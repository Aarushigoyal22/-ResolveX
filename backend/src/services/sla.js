import { pool } from '../config/db.js';

// Hours allowed to resolve a ticket, by priority
export const SLA_HOURS = { critical: 4, high: 8, medium: 24, low: 72 };
export const PRIORITY_ORDER = ['low', 'medium', 'high', 'critical'];

export const slaDueDate = (priority, from = new Date()) =>
  new Date(new Date(from).getTime() + SLA_HOURS[priority] * 36e5);

/**
 * Sweeper: finds live tickets past their SLA and escalates them.
 * Escalation = bump priority one level (max critical), raise escalation_level,
 * give a fresh SLA window, and record it in ticket_history.
 * FOR UPDATE SKIP LOCKED makes it safe if multiple API instances run it.
 */
export async function escalateOverdueTickets() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, priority FROM tickets
       WHERE status NOT IN ('resolved','closed') AND sla_due_at < NOW()
       FOR UPDATE SKIP LOCKED`);

    for (const t of rows) {
      const next = PRIORITY_ORDER[Math.min(PRIORITY_ORDER.indexOf(t.priority) + 1, 3)];
      await client.query(
        `UPDATE tickets SET priority=$1, escalation_level=escalation_level+1,
                sla_due_at=$2, updated_at=NOW() WHERE id=$3`,
        [next, slaDueDate(next), t.id]);
      await client.query(
        `INSERT INTO ticket_history (ticket_id, actor_id, action, detail)
         VALUES ($1, NULL, 'escalated', $2)`,
        [t.id, `SLA breached. Priority ${t.priority} -> ${next}`]);
    }
    await client.query('COMMIT');
    if (rows.length) console.log(`[SLA] escalated ${rows.length} ticket(s)`);
    return rows.length;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[SLA] sweep failed', err.message);
    return 0;
  } finally {
    client.release();
  }
}

export function startSlaMonitor() {
  const every = Number(process.env.SLA_CHECK_INTERVAL_MS) || 60000;
  escalateOverdueTickets();
  return setInterval(escalateOverdueTickets, every);
}
