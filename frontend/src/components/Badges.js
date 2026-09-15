import React from 'react';

// Badge colors come from CSS custom properties named after the value, so the
// palette lives entirely in index.css.
const tokenStyle = (value) => ({
  background: `var(--${value}-bg)`,
  color: `var(--${value})`,
});

export function StatusBadge({ status, label }) {
  return <span className="badge" style={tokenStyle(status)}>{label || status}</span>;
}

export function PriorityBadge({ priority, label }) {
  return <span className="badge" style={tokenStyle(priority)}>{label || priority}</span>;
}

export function OverdueBadge({ when }) {
  return <span className="badge badge-overdue" title={when ? `Due ${new Date(when).toLocaleString()}` : undefined}>Overdue</span>;
}
