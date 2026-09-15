import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';

const EMPTY = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  unitNumber: '',
  phone: '',
  role: 'homeowner',
  staffInviteCode: '',
};

export default function Register() {
  const { user, loading: authLoading, register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (authLoading) return <Spinner center />;
  if (user) return <Navigate to="/" replace />;

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  const isStaffSignup = form.role !== 'homeowner';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      // Only send the fields that apply to the chosen role.
      const payload = { ...form };
      if (!isStaffSignup) delete payload.staffInviteCode;
      else delete payload.unitNumber;

      await register(payload);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not create the account'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="card auth-card">
        <span className="brand"><span className="brand-mark">TSV</span> Property Services</span>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>Create your account.</p>

        <Alert>{error}</Alert>

        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="firstName">First name</label>
              <input id="firstName" required value={form.firstName} onChange={update('firstName')} />
            </div>
            <div className="field">
              <label htmlFor="lastName">Last name</label>
              <input id="lastName" required value={form.lastName} onChange={update('lastName')} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" required
              value={form.email} onChange={update('email')} />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="new-password" required minLength={8}
              value={form.password} onChange={update('password')} />
            <div className="field-hint">At least 8 characters.</div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="role">Account type</label>
              <select id="role" value={form.role} onChange={update('role')}>
                <option value="homeowner">Homeowner</option>
                <option value="staff">Maintenance staff</option>
                <option value="management">Management</option>
              </select>
            </div>

            {!isStaffSignup ? (
              <div className="field">
                <label htmlFor="unitNumber">Unit number</label>
                <input id="unitNumber" value={form.unitNumber} onChange={update('unitNumber')} />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="staffInviteCode">Staff invite code</label>
                <input id="staffInviteCode" required
                  value={form.staffInviteCode} onChange={update('staffInviteCode')} />
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="phone">Phone (optional)</label>
            <input id="phone" type="tel" value={form.phone} onChange={update('phone')} />
          </div>

          <button type="submit" className="block" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="auth-foot">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
