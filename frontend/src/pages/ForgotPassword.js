import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';

export default function ForgotPassword() {
  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, 'Could not send the reset link'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <span className="brand"><span className="brand-mark">TSV</span> Property Services</span>

        {sent ? (
          <>
            <h2 style={{ marginTop: 16 }}>Check your email</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              If <strong>{email}</strong> is registered, a reset link is on its way.
              The link works once and expires in an hour.
            </p>
            <p className="auth-foot"><Link to="/login">Back to sign in</Link></p>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 20px' }}>
              Enter your email and we will send you a link to choose a new password.
            </p>

            <Alert>{error}</Alert>

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" type="email" autoComplete="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <button type="submit" className="block" disabled={submitting}>
                {submitting ? 'Sending...' : 'Send reset link'}
              </button>
            </form>

            <p className="auth-foot">
              Remembered it? <Link to="/login">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
