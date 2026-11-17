import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';

const dir = path.dirname(fileURLToPath(import.meta.url));

// Retry so the API can start before Postgres is ready (docker compose)
for (let i = 1; i <= 10; i++) {
  try {
    await pool.query(fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8'));
    console.log('Schema ready');
    break;
  } catch (err) {
    if (i === 10) { console.error(err); process.exit(1); }
    console.log(`DB not ready (${i}/10), retrying...`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}
await pool.end();
