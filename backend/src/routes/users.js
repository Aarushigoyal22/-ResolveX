import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Agents with their current workload (used for the manual-assignment dropdown)
router.get('/agents', authorize('admin', 'agent'), async (_req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.name, u.is_available,
            COUNT(t.id) FILTER (WHERE t.status IN ('assigned','in_progress'))::int AS active_tickets
     FROM users u LEFT JOIN tickets t ON t.assigned_to = u.id
     WHERE u.role = 'agent' GROUP BY u.id ORDER BY u.name`);
  res.json(rows);
});

// Agent toggles own availability (e.g. on leave); admin can toggle anyone
router.patch('/:id/availability', async (req, res) => {
  const id = Number(req.params.id);
  if (req.user.role !== 'admin' && req.user.id !== id)
    return res.status(403).json({ error: 'You can only change your own availability' });
  const { rows } = await query(
    `UPDATE users SET is_available=$1 WHERE id=$2 AND role='agent' RETURNING id, is_available`,
    [!!req.body.is_available, id]);
  rows[0] ? res.json(rows[0]) : res.status(404).json({ error: 'Agent not found' });
});

// Admin creates staff accounts
router.post('/', authorize('admin'), async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!['agent', 'admin', 'user'].includes(role) || !name || !email || !password)
    return res.status(400).json({ error: 'name, email, password and a valid role are required' });
  const { rows } = await query(
    `INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id,name,email,role`,
    [name, email.toLowerCase(), await bcrypt.hash(password, 10), role]);
  res.status(201).json(rows[0]);
});

export default router;
