import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, authorize('admin', 'agent'));

router.get('/summary', async (_req, res) => {
  const [kpi, byStatus, byPriority, byCategory, trend, agents] = await Promise.all([
    query(`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed'))::int AS active,
        COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed') AND sla_due_at < NOW())::int AS overdue,
        ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)
              FILTER (WHERE resolved_at IS NOT NULL)::numeric, 1)::float AS avg_resolution_hours,
        ROUND(100.0 * COUNT(*) FILTER (WHERE resolved_at IS NOT NULL AND resolved_at <= sla_due_at)
              / NULLIF(COUNT(*) FILTER (WHERE resolved_at IS NOT NULL), 0), 1)::float AS sla_compliance_pct
      FROM tickets`),
    query(`SELECT status AS name, COUNT(*)::int AS value FROM tickets GROUP BY status`),
    query(`SELECT priority AS name, COUNT(*)::int AS value FROM tickets GROUP BY priority`),
    query(`SELECT category AS name, COUNT(*)::int AS value FROM tickets GROUP BY category ORDER BY value DESC`),
    // created vs resolved per day, last 14 days (generate_series keeps empty days)
    query(`SELECT to_char(d, 'DD Mon') AS day,
        (SELECT COUNT(*)::int FROM tickets WHERE created_at::date = d::date) AS created,
        (SELECT COUNT(*)::int FROM tickets WHERE resolved_at::date = d::date) AS resolved
      FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day') AS d ORDER BY d`),
    query(`SELECT u.id, u.name,
        COUNT(t.id) FILTER (WHERE t.status IN ('assigned','in_progress'))::int AS active,
        COUNT(t.id) FILTER (WHERE t.resolved_at IS NOT NULL)::int AS resolved,
        ROUND(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600)
              FILTER (WHERE t.resolved_at IS NOT NULL)::numeric, 1)::float AS avg_hours,
        ROUND(100.0 * COUNT(*) FILTER (WHERE t.resolved_at <= t.sla_due_at)
              / NULLIF(COUNT(*) FILTER (WHERE t.resolved_at IS NOT NULL), 0), 0)::float AS sla_pct
      FROM users u LEFT JOIN tickets t ON t.assigned_to = u.id
      WHERE u.role='agent' GROUP BY u.id ORDER BY resolved DESC`),
  ]);
  res.json({
    kpi: kpi.rows[0], byStatus: byStatus.rows, byPriority: byPriority.rows,
    byCategory: byCategory.rows, trend: trend.rows, agents: agents.rows,
  });
});

export default router;
