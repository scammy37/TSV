import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';

export default function Login() {
  const { user, loading: authLoading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (authLoading) return <Spinner center />;
  if (user) return <Navigate to={location.state?.from?.pathname || '/dashboard'} replace />;

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form);
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not sign in'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <span className="brand"><span className="brand-mark">TSV</span> Property Services</span>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
          Sign in to submit and track service requests.
        </p>

        <Alert>{error}</Alert>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" required
              value={form.email} onChange={update('email')} />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" required
              value={form.password} onChange={update('password')} />
          </div>

          <button type="submit" className="block" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="auth-foot" style={{ marginBottom: 6 }}>
          <Link to="/forgot-password">Forgot your password?</Link>
        </p>
        <p className="auth-foot" style={{ marginTop: 0 }}>
          No account yet? <Link to="/register">Register as a homeowner</Link>
        </p>
      </div>
    </div>
  );
}
