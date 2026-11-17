import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { slaDueDate } from '../services/sla.js';

const hash = await bcrypt.hash('password123', 10);
const people = [
  ['Admin', 'admin@resolvex.dev', 'admin'],
  ['Asha Agent', 'asha@resolvex.dev', 'agent'],
  ['Ravi Agent', 'ravi@resolvex.dev', 'agent'],
  ['Meera Agent', 'meera@resolvex.dev', 'agent'],
  ['Uma User', 'user@resolvex.dev', 'user'],
];
for (const [name, email, role] of people) {
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4)
     ON CONFLICT (email) DO NOTHING`, [name, email, hash, role]);
}

const { rows: [user] } = await pool.query(`SELECT id FROM users WHERE email='user@resolvex.dev'`);
const { rows: agents } = await pool.query(`SELECT id FROM users WHERE role='agent' ORDER BY id`);
const priorities = ['low', 'medium', 'high', 'critical'];
const categories = ['network', 'hardware', 'software', 'access', 'general'];
const statuses = ['assigned', 'in_progress', 'resolved', 'closed'];

// ~60 tickets spread over the last 14 days so the dashboard has something to show
for (let i = 0; i < 60; i++) {
  const p = priorities[i % 4];
  const status = statuses[i % 4];
  const created = new Date(Date.now() - Math.random() * 14 * 864e5);
  const due = slaDueDate(p, created);
  const resolved = ['resolved', 'closed'].includes(status)
    ? new Date(created.getTime() + Math.random() * 40 * 36e5) : null;
  await pool.query(
    `INSERT INTO tickets (title, description, category, status, priority, created_by, assigned_to,
                          sla_due_at, created_at, updated_at, resolved_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10)`,
    [`Sample issue #${i + 1}`, 'Seeded demo ticket.', categories[i % 5], status, p, user.id,
     agents[i % agents.length].id, due, created, resolved]);
}
console.log('Seeded. Login with admin@resolvex.dev / password123');
await pool.end();
