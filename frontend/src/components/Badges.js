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

// How long a ticket has been open, in the largest unit that still reads
// naturally. Past a week it is styled as a warning: nothing is formally late
// without an SLA, but an old open ticket is still the thing to look at.
export function formatAge(hours) {
  if (hours === null || hours === undefined) return '--';
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.floor(hours)}h old`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d old`;
  return `${Math.floor(days / 7)}w old`;
}

export function AgeBadge({ hours }) {
  if (hours === null || hours === undefined) return null;
  const aging = hours >= 24 * 7;
  return (
    <span className={`badge${aging ? ' badge-overdue' : ''}`} style={aging ? undefined : tokenStyle('low')}>
      {formatAge(hours)}
    </span>
  );
}
