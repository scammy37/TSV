import React, { useCallback, useEffect, useState } from 'react';

import { api, errorMessage } from '../api/client';
import Alert from '../components/Alert';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { formatRelative } from '../utils/format';

const ROLES = [
  { value: 'homeowner', label: 'Homeowner' },
  { value: 'staff', label: 'Maintenance staff' },
  { value: 'management', label: 'Management' },
];

export default function Users() {
  const { user: currentUser } = useAuth();

  const [filters, setFilters] = useState({ q: '', role: '', includeInactive: false });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => ({ ...f, q: search })), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== '' && v !== false),
      );
      const data = await api.listUsers({ ...params, limit: 100 });
      setUsers(data.users);
    } catch (err) {
      setError(errorMessage(err, 'Could not load the directory'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const patch = async (id, payload, message) => {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      const updated = await api.updateUser(id, payload);
      setUsers((current) => current.map((u) => (u.id === id ? updated : u)));
      setNotice(message);
    } catch (err) {
      setError(errorMessage(err, 'Could not update that account'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>People</h1>
          <p>Homeowners, maintenance staff and managers with access to the portal.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="filters" style={{ marginBottom: 0 }}>
          <div className="field grow">
            <label htmlFor="q">Search</label>
            <input id="q" placeholder="Name, email or address"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="role">Role</label>
            <select id="role" value={filters.role}
              onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}>
              <option value="">Any role</option>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="checkbox" style={{ marginTop: 22 }}>
              <input type="checkbox" checked={filters.includeInactive}
                onChange={(e) => setFilters((f) => ({ ...f, includeInactive: e.target.checked }))} />
              Show deactivated
            </label>
          </div>
        </div>
      </div>

      <Alert onDismiss={() => setError('')}>{error}</Alert>
      <Alert kind="success" onDismiss={() => setNotice('')}>{notice}</Alert>

      {loading ? <Spinner center /> : users.length === 0 ? (
        <div className="card"><EmptyState title="Nobody matches">Try a different search.</EmptyState></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Address</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} style={u.isActive ? undefined : { opacity: 0.55 }}>
                      <td>
                        {u.fullName}
                        {isSelf && <span style={{ color: 'var(--text-faint)' }}> (you)</span>}
                        {!u.isActive && <span className="badge badge-overdue" style={{ marginLeft: 8 }}>Deactivated</span>}
                      </td>
                      <td>{u.email}</td>
                      <td>{u.unitNumber || '--'}</td>
                      <td>
                        <select
                          value={u.role}
                          disabled={busyId === u.id || isSelf}
                          title={isSelf ? 'You cannot change your own role' : undefined}
                          onChange={(e) => patch(u.id, { role: e.target.value },
                            `${u.fullName} is now ${e.target.value}`)}
                        >
                          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </td>
                      <td>{formatRelative(u.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          className={u.isActive ? 'secondary sm' : 'sm'}
                          disabled={busyId === u.id || isSelf}
                          title={isSelf ? 'You cannot deactivate your own account' : undefined}
                          onClick={() => patch(u.id, { isActive: !u.isActive },
                            `${u.fullName} ${u.isActive ? 'deactivated' : 'reactivated'}`)}
                        >
                          {u.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
