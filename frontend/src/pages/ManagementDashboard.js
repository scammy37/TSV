import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { api, errorMessage } from '../api/client';
import useMeta from '../hooks/useMeta';
import Alert from '../components/Alert';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import TicketRow from '../components/TicketRow';

const DEFAULT_FILTERS = {
  q: '',
  status: '',
  priority: '',
  category: '',
  assignedTo: '',
  overdue: false,
  sort: 'created_at',
  order: 'desc',
  page: 1,
};

// Quick views sit above the filter bar; each one just presets the filters.
const QUICK_VIEWS = [
  { key: 'active', label: 'Active', patch: { status: '', assignedTo: '', overdue: false, open: true } },
  { key: 'unassigned', label: 'Unassigned', patch: { assignedTo: 'unassigned', overdue: false, open: true } },
  { key: 'mine', label: 'Assigned to me', patch: { assignedTo: 'me', overdue: false, open: true } },
  { key: 'overdue', label: 'Overdue', patch: { overdue: true, assignedTo: '', open: true } },
  { key: 'all', label: 'All tickets', patch: { assignedTo: '', overdue: false, open: undefined } },
];

export default function ManagementDashboard() {
  const { meta } = useMeta();

  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, open: true });
  const [quickView, setQuickView] = useState('active');
  const [data, setData] = useState({ tickets: [], pagination: null });
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Debounced so typing in the search box does not fire a request per keystroke.
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => ({ ...f, q: search, page: 1 })), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Drop empty filters so the API sees only what was actually chosen.
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== '' && v !== false && v !== undefined),
      );
      params.limit = 25;
      setData(await api.listTickets(params));
    } catch (err) {
      setError(errorMessage(err, 'Could not load the ticket queue'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.assignableUsers().then(setStaff).catch(() => setStaff([]));
  }, []);

  const applyQuickView = (view) => {
    setQuickView(view.key);
    setFilters((f) => ({ ...f, ...view.patch, page: 1 }));
  };

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFilters((f) => ({ ...f, [field]: value, page: 1 }));
  };

  const labels = useMemo(() => ({
    statuses: meta?.statusLabels,
    priorities: meta?.priorityLabels,
  }), [meta]);

  const pagination = data.pagination;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ticket queue</h1>
          <p>
            {pagination
              ? `${pagination.total} ticket${pagination.total === 1 ? '' : 's'} match the current view.`
              : 'Triage, assign and resolve incoming requests.'}
          </p>
        </div>
      </div>

      <div className="filters">
        {QUICK_VIEWS.map((view) => (
          <button
            key={view.key}
            type="button"
            className={quickView === view.key ? '' : 'secondary'}
            onClick={() => applyQuickView(view)}
          >
            {view.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="filters" style={{ marginBottom: 0 }}>
          <div className="field grow">
            <label htmlFor="q">Search</label>
            <input id="q" placeholder="Title, description or ticket number"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" value={filters.status} onChange={update('status')}>
              <option value="">Any status</option>
              {meta?.statuses.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="priority">Priority</label>
            <select id="priority" value={filters.priority} onChange={update('priority')}>
              <option value="">Any priority</option>
              {meta?.priorities.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="category">Category</label>
            <select id="category" value={filters.category} onChange={update('category')}>
              <option value="">Any category</option>
              {meta?.categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="assignedTo">Assignee</label>
            <select id="assignedTo" value={filters.assignedTo} onChange={update('assignedTo')}>
              <option value="">Anyone</option>
              <option value="unassigned">Unassigned</option>
              <option value="me">Me</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.fullName}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="sort">Sort by</label>
            <select id="sort" value={filters.sort} onChange={update('sort')}>
              <option value="created_at">Newest first</option>
              <option value="updated_at">Recently updated</option>
              <option value="priority">Priority</option>
              <option value="sla_deadline">SLA deadline</option>
            </select>
          </div>
        </div>
      </div>

      <Alert>{error}</Alert>

      {loading ? <Spinner center /> : data.tickets.length === 0 ? (
        <div className="card">
          <EmptyState title="Nothing matches">
            Try widening the filters or clearing the search box.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="ticket-list">
            {data.tickets.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} labels={labels} showHomeowner />
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="pagination">
              <button type="button" className="secondary sm" disabled={pagination.page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>
                Previous
              </button>
              <span>Page {pagination.page} of {pagination.totalPages}</span>
              <button type="button" className="secondary sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
