const express = require('express');

const db = require('../db/connection');
const asyncHandler = require('../utils/asyncHandler');
const {
  PRIORITIES, STATUSES, PRIORITY_LABELS, STATUS_LABELS, STATUS_TRANSITIONS,
} = require('../constants');

const router = express.Router();

/**
 * GET /api/meta
 * The vocabulary the frontend renders its dropdowns and badges from, so the
 * two sides can never disagree about what a valid status or category is.
 */
router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'SELECT slug, name, description FROM categories WHERE is_active ORDER BY sort_order, name',
  );

  res.json({
    categories: rows,
    priorities: PRIORITIES.map((value) => ({
      value, label: PRIORITY_LABELS[value],
    })),
    statuses: STATUSES.map((value) => ({
      value, label: STATUS_LABELS[value], next: STATUS_TRANSITIONS[value] || [],
    })),
  });
}));

module.exports = router;
