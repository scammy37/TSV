const express = require('express');

const db = require('../db/connection');
const { authenticate, authorize } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES, STATUSES, PRIORITIES } = require('../constants');

const router = express.Router();

router.use(authenticate, authorize(ROLES.STAFF, ROLES.MANAGEMENT));

// Turns [{key, count}] rows into a complete map, so the dashboard never has to
// handle a missing bucket.
const bucket = (rows, keys, keyColumn) => {
  const out = Object.fromEntries(keys.map((k) => [k, 0]));
  rows.forEach((row) => { out[row[keyColumn]] = Number(row.count); });
  return out;
};

/**
 * GET /api/reports/summary
 * Everything the management dashboard's header and charts need, in one round
 * trip: volume by status/priority/category, SLA health, throughput and the
 * per-assignee workload.
 */
router.get('/summary', asyncHandler(async (req, res) => {
  const [byStatus, byPriority, byCategory, totals, byAssignee, recentVolume] = await Promise.all([
    db.query('SELECT status, COUNT(*)::int AS count FROM tickets GROUP BY status'),

    db.query(`SELECT priority, COUNT(*)::int AS count FROM tickets
              WHERE status NOT IN ('resolved', 'closed', 'cancelled')
              GROUP BY priority`),

    db.query(`SELECT t.category, c.name AS category_name, COUNT(*)::int AS count
              FROM tickets t LEFT JOIN categories c ON c.slug = t.category
              GROUP BY t.category, c.name
              ORDER BY count DESC`),

    db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed','cancelled'))::int AS open,
        COUNT(*) FILTER (WHERE assigned_to IS NULL
                           AND status NOT IN ('resolved','closed','cancelled'))::int AS unassigned,
        COUNT(*) FILTER (WHERE sla_deadline < now()
                           AND status NOT IN ('resolved','closed','cancelled'))::int AS overdue,
        COUNT(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS created_last_7_days,
        COUNT(*) FILTER (WHERE resolved_at > now() - interval '7 days')::int AS resolved_last_7_days,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
          FILTER (WHERE resolved_at IS NOT NULL) AS avg_resolution_hours,
        AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 3600)
          FILTER (WHERE first_response_at IS NOT NULL) AS avg_first_response_hours,
        COUNT(*) FILTER (WHERE resolved_at IS NOT NULL AND resolved_at <= sla_deadline)::int AS met_sla,
        COUNT(*) FILTER (WHERE resolved_at IS NOT NULL AND resolved_at > sla_deadline)::int AS missed_sla
      FROM tickets`),

    db.query(`
      SELECT u.id, u.first_name, u.last_name,
             COUNT(t.id) FILTER (WHERE t.status NOT IN ('resolved','closed','cancelled'))::int AS open_count,
             COUNT(t.id) FILTER (WHERE t.resolved_at > now() - interval '30 days')::int AS resolved_30d,
             COUNT(t.id) FILTER (WHERE t.sla_deadline < now()
                                   AND t.status NOT IN ('resolved','closed','cancelled'))::int AS overdue_count
      FROM users u
      LEFT JOIN tickets t ON t.assigned_to = u.id
      WHERE u.role IN ('staff','management') AND u.is_active
      GROUP BY u.id
      ORDER BY open_count DESC, u.first_name`),

    db.query(`
      SELECT date_trunc('day', created_at)::date AS day,
             COUNT(*)::int AS created,
             COUNT(*) FILTER (WHERE resolved_at IS NOT NULL)::int AS resolved
      FROM tickets
      WHERE created_at > now() - interval '30 days'
      GROUP BY day
      ORDER BY day`),
  ]);

  const t = totals.rows[0];
  const slaTotal = t.met_sla + t.missed_sla;

  res.json({
    totals: {
      total: t.total,
      open: t.open,
      unassigned: t.unassigned,
      overdue: t.overdue,
      createdLast7Days: t.created_last_7_days,
      resolvedLast7Days: t.resolved_last_7_days,
      avgResolutionHours: t.avg_resolution_hours === null ? null : Number(Number(t.avg_resolution_hours).toFixed(1)),
      avgFirstResponseHours: t.avg_first_response_hours === null
        ? null : Number(Number(t.avg_first_response_hours).toFixed(1)),
      slaCompliance: slaTotal === 0 ? null : Math.round((t.met_sla / slaTotal) * 100),
    },
    byStatus: bucket(byStatus.rows, STATUSES, 'status'),
    byPriority: bucket(byPriority.rows, PRIORITIES, 'priority'),
    byCategory: byCategory.rows.map((r) => ({
      category: r.category,
      name: r.category_name || r.category,
      count: Number(r.count),
    })),
    byAssignee: byAssignee.rows.map((r) => ({
      id: r.id,
      fullName: `${r.first_name} ${r.last_name}`,
      openCount: r.open_count,
      resolvedLast30Days: r.resolved_30d,
      overdueCount: r.overdue_count,
    })),
    dailyVolume: recentVolume.rows.map((r) => ({
      day: r.day,
      created: r.created,
      resolved: r.resolved,
    })),
  });
}));

module.exports = router;
