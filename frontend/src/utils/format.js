const RELATIVE_UNITS = [
  { limit: 60, divisor: 1, unit: 'second' },
  { limit: 3600, divisor: 60, unit: 'minute' },
  { limit: 86400, divisor: 3600, unit: 'hour' },
  { limit: 2592000, divisor: 86400, unit: 'day' },
  { limit: 31536000, divisor: 2592000, unit: 'month' },
  { limit: Infinity, divisor: 31536000, unit: 'year' },
];

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "3 hours ago", "in 2 days" -- tolerant of null and unparseable input. */
export const formatRelative = (value) => {
  if (!value) return '--';
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return '--';

  const seconds = (then.getTime() - Date.now()) / 1000;
  const magnitude = Math.abs(seconds);
  const { divisor, unit } = RELATIVE_UNITS.find((u) => magnitude < u.limit);

  return relativeFormatter.format(Math.round(seconds / divisor), unit);
};

export const formatDateTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

export const formatHours = (hours) => {
  if (hours === null || hours === undefined) return '--';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
};

/** Turns snake_case audit-trail fields into something readable. */
export const humanize = (value) => {
  if (value === null || value === undefined || value === '') return '--';
  return String(value).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
};
