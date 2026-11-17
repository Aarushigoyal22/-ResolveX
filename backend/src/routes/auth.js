import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const sign = (u) =>
  jwt.sign({ id: u.id, role: u.role, name: u.name }, process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

// Public sign-up always creates a regular 'user'. Staff accounts are made by an admin.
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password || password.length < 8)
    return res.status(400).json({ error: 'Name, email and a password of 8+ characters are required' });
  try {
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3)
       RETURNING id, name, email, role`,
      [name, email.toLowerCase(), await bcrypt.hash(password, 10)]);
    res.status(201).json({ token: sign(rows[0]), user: rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'That email is already registered' });
    throw e;
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const { rows } = await query('SELECT * FROM users WHERE email=$1', [(email || '').toLowerCase()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password || '', u.password_hash)))
    return res.status(401).json({ error: 'Incorrect email or password' });
  res.json({ token: sign(u), user: { id: u.id, name: u.name, email: u.email, role: u.role } });
});

router.get('/me', authenticate, async (req, res) => {
  const { rows } = await query('SELECT id, name, email, role, is_available FROM users WHERE id=$1', [req.user.id]);
  res.json(rows[0]);
});

export default router;
