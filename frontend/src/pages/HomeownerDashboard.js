import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { api, errorMessage } from '../api/client';
import useMeta from '../hooks/useMeta';
import Alert from '../components/Alert';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import TicketRow from '../components/TicketRow';
import { useAuth } from '../context/AuthContext';

const VIEWS = [
  { key: 'open', label: 'Open', params: { open: true } },
  { key: 'closed', label: 'Closed', params: { open: false } },
  { key: 'all', label: 'All', params: {} },
];

export default function HomeownerDashboard() {
  const { user } = useAuth();
  const { meta } = useMeta();

  const [view, setView] = useState('open');
  const [data, setData] = useState({ tickets: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = VIEWS.find((v) => v.key === view).params;
      setData(await api.listTickets({ ...params, limit: 50 }));
    } catch (err) {
      setError(errorMessage(err, 'Could not load your requests'));
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => { load(); }, [load]);

  const labels = useMemo(() => ({
    statuses: meta?.statusLabels,
    priorities: meta?.priorityLabels,
  }), [meta]);

  const openCount = data.tickets.filter(
    (t) => !['closed', 'cancelled'].includes(t.status),
  ).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hello, {user?.firstName}</h1>
          <p>
            {view === 'open' && openCount > 0
              ? `You have ${openCount} request${openCount === 1 ? '' : 's'} in progress.`
              : 'Submit a request and we will take it from there.'}
          </p>
        </div>
        <Link to="/tickets/new"><button type="button">New request</button></Link>
      </div>

      <div className="filters">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            className={view === v.key ? '' : 'secondary'}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <Alert>{error}</Alert>

      {loading ? <Spinner center /> : data.tickets.length === 0 ? (
        <div className="card">
          <EmptyState
            title={view === 'open' ? 'No open requests' : 'Nothing here yet'}
            action={<Link to="/tickets/new"><button type="button">Submit a request</button></Link>}
          >
            {view === 'open'
              ? 'Everything you have submitted has been dealt with.'
              : 'Your submitted requests will appear here.'}
          </EmptyState>
        </div>
      ) : (
        <div className="ticket-list">
          {data.tickets.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} labels={labels} agingDays={meta?.agingDays} />
          ))}
        </div>
      )}
    </>
  );
}
