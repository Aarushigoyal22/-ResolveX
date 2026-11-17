/**
 * Workload-aware assignment: among available agents, pick the one with the
 * fewest active (assigned / in_progress) tickets. Ties go to whoever has
 * gone longest without a new ticket, so work rotates fairly.
 * Accepts a client so it can run inside the caller's transaction.
 */
export async function pickAgent(db) {
  const { rows } = await db.query(
    `SELECT u.id,
            COUNT(t.id) FILTER (WHERE t.status IN ('assigned','in_progress')) AS load,
            MAX(t.created_at) AS last_assigned
     FROM users u
     LEFT JOIN tickets t ON t.assigned_to = u.id
     WHERE u.role = 'agent' AND u.is_available
     GROUP BY u.id
     ORDER BY load ASC, last_assigned ASC NULLS FIRST, u.id
     LIMIT 1`);
  return rows[0]?.id ?? null;
}
