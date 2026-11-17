import { Router } from 'express';
import { pool, query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { pickAgent } from '../services/assignment.js';
import { slaDueDate, PRIORITY_ORDER } from '../services/sla.js';

const router = Router();
router.use(authenticate);

// Allowed lifecycle moves
const TRANSITIONS = {
  open: ['assigned'],
  assigned: ['in_progress'],
  in_progress: ['resolved'],
  resolved: ['closed', 'in_progress'], // reopen allowed
  closed: [],
};

const log = (db, ticketId, actorId, action, detail) =>
  db.query(`INSERT INTO ticket_history (ticket_id, actor_id, action, detail) VALUES ($1,$2,$3,$4)`,
    [ticketId, actorId, action, detail]);

// ---------- LIST + FILTER + PAGINATE ----------
router.get('/', async (req, res) => {
  const { status, priority, category, assigned_to, q, overdue, page = 1, limit = 15 } = req.query;
  const where = [];
  const p = [];
  const add = (sql, v) => { p.push(v); where.push(sql.replace('?', `$${p.length}`)); };

  if (req.user.role === 'user') add('t.created_by = ?', req.user.id); // users only see their own
  if (status) add('t.status = ?', status);
  if (priority) add('t.priority = ?', priority);
  if (category) add('t.category = ?', category);
  if (assigned_to === 'me') add('t.assigned_to = ?', req.user.id);
  else if (assigned_to) add('t.assigned_to = ?', Number(assigned_to));
  if (q) add('t.title ILIKE ?', `%${q}%`);
  if (overdue === 'true') where.push(`t.status NOT IN ('resolved','closed') AND t.sla_due_at < NOW()`);

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const lim = Math.min(Number(limit) || 15, 100);
  const offset = (Math.max(Number(page), 1) - 1) * lim;

  const [rows, count] = await Promise.all([
    query(
      `SELECT t.*, c.name AS created_by_name, a.name AS assigned_to_name,
              (t.status NOT IN ('resolved','closed') AND t.sla_due_at < NOW()) AS is_overdue
       FROM tickets t
       JOIN users c ON c.id = t.created_by
       LEFT JOIN users a ON a.id = t.assigned_to
       ${clause}
       ORDER BY t.created_at DESC LIMIT ${lim} OFFSET ${offset}`, p),
    query(`SELECT COUNT(*)::int AS n FROM tickets t ${clause}`, p),
  ]);
  res.json({ data: rows.rows, total: count.rows[0].n, page: Number(page), limit: lim });
});

// ---------- CREATE (auto-assign inside a transaction) ----------
router.post('/', async (req, res) => {
  const { title, description, category = 'general', priority = 'medium' } = req.body || {};
  if (!title || !description) return res.status(400).json({ error: 'Title and description are required' });
  if (!PRIORITY_ORDER.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialise assignment so two simultaneous tickets don't both pick the same agent
    await client.query('SELECT pg_advisory_xact_lock(42)');
    const agentId = await pickAgent(client);
    const { rows } = await client.query(
      `INSERT INTO tickets (title, description, category, priority, status, created_by, assigned_to, sla_due_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [title, description, category, priority, agentId ? 'assigned' : 'open',
       req.user.id, agentId, slaDueDate(priority)]);
    const t = rows[0];
    await log(client, t.id, req.user.id, 'created', `Priority ${priority}`);
    if (agentId) await log(client, t.id, null, 'assigned', `Auto-assigned to agent #${agentId} (lowest workload)`);
    await client.query('COMMIT');
    res.status(201).json(t);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// ---------- DETAIL ----------
router.get('/:id', async (req, res) => {
  const { rows } = await query(
    `SELECT t.*, c.name AS created_by_name, a.name AS assigned_to_name,
            (t.status NOT IN ('resolved','closed') AND t.sla_due_at < NOW()) AS is_overdue
     FROM tickets t JOIN users c ON c.id=t.created_by LEFT JOIN users a ON a.id=t.assigned_to
     WHERE t.id=$1`, [req.params.id]);
  const t = rows[0];
  if (!t) return res.status(404).json({ error: 'Ticket not found' });
  if (req.user.role === 'user' && t.created_by !== req.user.id)
    return res.status(403).json({ error: 'This ticket belongs to someone else' });

  const [comments, history] = await Promise.all([
    query(`SELECT c.*, u.name AS author FROM ticket_comments c JOIN users u ON u.id=c.user_id
           WHERE ticket_id=$1 ORDER BY c.created_at`, [t.id]),
    query(`SELECT h.*, u.name AS actor FROM ticket_history h LEFT JOIN users u ON u.id=h.actor_id
           WHERE ticket_id=$1 ORDER BY h.created_at`, [t.id]),
  ]);
  res.json({ ...t, comments: comments.rows, history: history.rows });
});

// ---------- STATUS (assigned agent, or admin) ----------
router.patch('/:id/status', authorize('admin', 'agent'), async (req, res) => {
  const { status } = req.body || {};
  const { rows } = await query('SELECT * FROM tickets WHERE id=$1', [req.params.id]);
  const t = rows[0];
  if (!t) return res.status(404).json({ error: 'Ticket not found' });
  if (req.user.role === 'agent' && t.assigned_to !== req.user.id)
    return res.status(403).json({ error: 'Only the assigned agent can update this ticket' });
  if (!TRANSITIONS[t.status].includes(status))
    return res.status(400).json({ error: `Cannot move from ${t.status} to ${status}` });

  const resolvedAt = status === 'resolved' ? 'NOW()' : status === 'in_progress' ? 'NULL' : 'resolved_at';
  const { rows: upd } = await query(
    `UPDATE tickets SET status=$1, updated_at=NOW(), resolved_at=${resolvedAt} WHERE id=$2 RETURNING *`,
    [status, t.id]);
  await log({ query }, t.id, req.user.id, 'status_changed', `${t.status} -> ${status}`);
  res.json(upd[0]);
});

// ---------- MANUAL (RE)ASSIGN: admin ----------
router.patch('/:id/assign', authorize('admin'), async (req, res) => {
  const { agent_id } = req.body || {};
  const { rows: a } = await query(`SELECT id, name FROM users WHERE id=$1 AND role='agent'`, [agent_id]);
  if (!a[0]) return res.status(400).json({ error: 'That user is not an agent' });
  const { rows } = await query(
    `UPDATE tickets SET assigned_to=$1,
            status = CASE WHEN status='open' THEN 'assigned'::ticket_status ELSE status END,
            updated_at=NOW()
     WHERE id=$2 AND status NOT IN ('resolved','closed') RETURNING *`, [agent_id, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Ticket not found or already resolved' });
  await log({ query }, rows[0].id, req.user.id, 'assigned', `Assigned to ${a[0].name}`);
  res.json(rows[0]);
});

// ---------- COMMENTS ----------
router.post('/:id/comments', async (req, res) => {
  const body = (req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Comment cannot be empty' });
  const { rows: t } = await query('SELECT created_by FROM tickets WHERE id=$1', [req.params.id]);
  if (!t[0]) return res.status(404).json({ error: 'Ticket not found' });
  if (req.user.role === 'user' && t[0].created_by !== req.user.id)
    return res.status(403).json({ error: 'This ticket belongs to someone else' });
  const { rows } = await query(
    `INSERT INTO ticket_comments (ticket_id, user_id, body) VALUES ($1,$2,$3) RETURNING *`,
    [req.params.id, req.user.id, body]);
  res.status(201).json({ ...rows[0], author: req.user.name });
});

export default router;
