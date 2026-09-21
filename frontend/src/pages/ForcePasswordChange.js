import React, { useState } from 'react';

import { api, errorMessage } from '../api/client';
import Alert from '../components/Alert';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';

/**
 * Where an account lands when management has issued it a temporary password.
 *
 * The API refuses every other request until that password is replaced, so this
 * is deliberately a dead end rather than a page with a way out: no app shell,
 * no navigation, and the only escape besides setting a password is to sign out.
 *
 * The temporary password is asked for rather than taken on trust, so that
 * possession of a half-finished session -- a shared machine, a borrowed phone
 * -- is not by itself enough to seize the account.
 */
export default function ForcePasswordChange() {
  const { user, logout, adoptSession } = useAuth();

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (form.newPassword !== form.confirmPassword) {
      setError('The two new passwords do not match');
      return;
    }
    if (form.newPassword === form.currentPassword) {
      setError('Choose a password different from the temporary one');
      return;
    }

    setError('');
    setBusy(true);
    try {
      const { token, user: updated } = await api.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      // Adopting the returned session clears mustChangePassword, which is what
      // releases the rest of the app.
      adoptSession(token, updated);
    } catch (err) {
      setError(errorMessage(err, 'Could not set the password'));
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <span className="brand"><Logo size={26} /> <span className="brand-text">Townsquare Village HOA</span></span>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
          Your account is on a temporary password issued by the association
          office. Choose one of your own to continue.
        </p>

        <Alert>{error}</Alert>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="currentPassword">Temporary password</label>
            <input id="currentPassword" type="password" autoComplete="current-password" required autoFocus
              value={form.currentPassword} onChange={update('currentPassword')} />
            <div className="field-hint">The one the office gave you.</div>
          </div>

          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <input id="newPassword" type="password" autoComplete="new-password" required minLength={8}
              value={form.newPassword} onChange={update('newPassword')} />
            <div className="field-hint">At least 8 characters.</div>
          </div>

          <div className="field">
            <label htmlFor="confirmPassword">Confirm new password</label>
            <input id="confirmPassword" type="password" autoComplete="new-password" required minLength={8}
              value={form.confirmPassword} onChange={update('confirmPassword')} />
          </div>

          <button type="submit" className="block" disabled={busy}>
            {busy ? 'Saving...' : 'Set password and continue'}
          </button>
        </form>

        <p className="auth-foot">
          Signed in as {user?.email}.{' '}
          <button type="button" className="secondary sm" onClick={logout}>Sign out</button>
        </p>
      </div>
    </div>
  );
}
