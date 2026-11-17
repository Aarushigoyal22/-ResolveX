import 'express-async-errors';
import 'dotenv/config';
import app from './app.js';
import { startSlaMonitor } from './services/sla.js';

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`ResolveX API on :${port}`);
  startSlaMonitor();
});
