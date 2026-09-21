import React, { useEffect, useState } from 'react';

import { api, errorMessage } from '../api/client';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import useMeta from '../hooks/useMeta';
import { formatHours } from '../utils/format';

// A labelled proportional bar -- enough to read a distribution at a glance
// without pulling in a charting library.
function BarRow({ label, count, max, color }) {
  // A zero count shows an empty track; anything else gets a visible sliver at
  // minimum, so a count of 1 next to a count of 900 is still readable.
  const width = count > 0 && max > 0 ? Math.max(3, (count / max) * 100) : 0;
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <span className="bar-track">
        <span className="bar-fill" style={{ width: `${width}%`, background: color }} />
      </span>
      <span className="bar-count">{count}</span>
    </div>
  );
}

export default function Reports() {
  const { meta } = useMeta();
  const agingDays = meta?.agingDays ?? 7;
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.reportSummary()
      .then(setSummary)
      .catch((err) => setError(errorMessage(err, 'Could not load the report')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner center />;
  if (error) return <Alert>{error}</Alert>;

  const { totals, byStatus, byPriority, byCategory, byAssignee, dailyVolume } = summary;
  const maxCategory = Math.max(1, ...byCategory.map((c) => c.count));
  const maxStatus = Math.max(1, ...Object.values(byStatus));
  const maxDaily = Math.max(1, ...dailyVolume.map((d) => Math.max(d.created, d.resolved)));
  const maxWeekly = Math.max(1, totals.createdLast7Days, totals.resolvedLast7Days);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p>Volume, workload and ticket age across the association.</p>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Open</div>
          <div className="stat-value">{totals.open}</div>
          <div className="stat-sub">{totals.total} all time</div>
        </div>
        <div className={`stat${totals.agingOpen > 0 ? ' alarm' : ''}`}>
          <div className="stat-label">{`Open over ${agingDays} days`}</div>
          <div className="stat-value">{totals.agingOpen}</div>
          <div className="stat-sub">still unresolved</div>
        </div>
        <div className={`stat${totals.unassigned > 0 ? ' alarm' : ''}`}>
          <div className="stat-label">Unassigned</div>
          <div className="stat-value">{totals.unassigned}</div>
          <div className="stat-sub">waiting for an owner</div>
        </div>
        <div className="stat">
          <div className="stat-label">Oldest open</div>
          <div className="stat-value">{formatHours(totals.oldestOpenHours)}</div>
          <div className="stat-sub">longest unresolved</div>
        </div>
        <div className="stat">
          <div className="stat-label">Avg resolution</div>
          <div className="stat-value">{formatHours(totals.avgResolutionHours)}</div>
          <div className="stat-sub">first report to fix</div>
        </div>
        <div className="stat">
          <div className="stat-label">Avg first response</div>
          <div className="stat-value">{formatHours(totals.avgFirstResponseHours)}</div>
          <div className="stat-sub">time to first touch</div>
        </div>
      </div>

      <div className="card">
        <h3>Last 7 days</h3>
        <BarRow label="Created" count={totals.createdLast7Days} max={maxWeekly} />
        <BarRow label="Resolved" count={totals.resolvedLast7Days} max={maxWeekly}
          color="var(--success)" />
      </div>

      <div className="card">
        <h3>By status</h3>
        {Object.entries(byStatus).map(([status, count]) => (
          <BarRow key={status} label={status.replace(/_/g, ' ')} count={count} max={maxStatus} />
        ))}
      </div>

      <div className="card">
        <h3>Open tickets by priority</h3>
        {Object.entries(byPriority).map(([priority, count]) => (
          <BarRow key={priority} label={priority} count={count}
            max={Math.max(1, ...Object.values(byPriority))} />
        ))}
      </div>

      <div className="card">
        <h3>By category</h3>
        {byCategory.length === 0
          ? <p style={{ color: 'var(--text-muted)' }}>No tickets yet.</p>
          : byCategory.map((c) => (
            <BarRow key={c.category} label={c.name} count={c.count} max={maxCategory} />
          ))}
      </div>

      <div className="card">
        <h3>Workload by assignee</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Staff member</th>
                <th className="num">Open</th>
                <th className="num">{`Over ${agingDays}d`}</th>
                <th className="num">Resolved (30d)</th>
              </tr>
            </thead>
            <tbody>
              {byAssignee.length === 0 ? (
                <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>No staff accounts yet.</td></tr>
              ) : byAssignee.map((a) => (
                <tr key={a.id}>
                  <td>{a.fullName}</td>
                  <td className="num">{a.openCount}</td>
                  <td className="num" style={a.agingCount > 0 ? { color: 'var(--danger)', fontWeight: 650 } : undefined}>
                    {a.agingCount}
                  </td>
                  <td className="num">{a.resolvedLast30Days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Daily volume (last 30 days)</h3>
        {dailyVolume.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No activity in the last 30 days.</p>
        ) : dailyVolume.map((day) => (
          <BarRow
            key={day.day}
            label={new Date(day.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            count={day.created}
            max={maxDaily}
          />
        ))}
      </div>
    </>
  );
}
