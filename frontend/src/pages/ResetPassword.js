import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { adoptSession } = useAuth();

  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (password !== confirm) {
      setError('The two passwords do not match');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      // A successful reset hands back a session, so there is no second sign-in.
      const { token: sessionToken, user } = await api.resetPassword({ token, password });
      adoptSession(sessionToken, user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not reset the password'));
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <span className="brand"><span className="brand-mark">TSV</span> Property Services</span>

        {!token ? (
          <>
            <h2 style={{ marginTop: 16 }}>Link is incomplete</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              This reset link is missing its token. Request a new one.
            </p>
            <p className="auth-foot"><Link to="/forgot-password">Send a new link</Link></p>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 20px' }}>
              Choose a new password for your account.
            </p>

            <Alert>{error}</Alert>

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="password">New password</label>
                <input id="password" type="password" autoComplete="new-password"
                  required minLength={8}
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                <div className="field-hint">At least 8 characters.</div>
              </div>

              <div className="field">
                <label htmlFor="confirm">Confirm new password</label>
                <input id="confirm" type="password" autoComplete="new-password"
                  required minLength={8}
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>

              <button type="submit" className="block" disabled={submitting}>
                {submitting ? 'Saving...' : 'Set new password'}
              </button>
            </form>

            <p className="auth-foot">
              Link expired? <Link to="/forgot-password">Request another</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
