import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api, errorMessage } from '../api/client';
import useMeta from '../hooks/useMeta';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';

export default function NewTicket() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { meta, loading: metaLoading } = useMeta();

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'medium',
    locationDetails: '',
    unitNumber: user?.unitNumber || '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const ticket = await api.createTicket(form);
      navigate(`/tickets/${ticket.id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not submit the request'));
      setSubmitting(false);
    }
  };

  if (metaLoading) return <Spinner center />;


  return (
    <>
      <div className="page-head">
        <div>
          <h1>New request</h1>
          <p>Report a problem with the grounds, a shared space, or the community rules.
            Repairs inside your own home stay with the homeowner.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <Alert>{error}</Alert>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="title">What&rsquo;s the issue?</label>
            <input id="title" required minLength={5} maxLength={255}
              placeholder="Pool gate is not latching"
              value={form.title} onChange={update('title')} />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="category">Category</label>
              <select id="category" required value={form.category} onChange={update('category')}>
                <option value="" disabled>Choose a category</option>
                {meta?.categories.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="priority">Priority</label>
              <select id="priority" value={form.priority} onChange={update('priority')}>
                {meta?.priorities.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="description">Describe the issue</label>
            <textarea id="description" required minLength={10} rows={6}
              placeholder="When did you notice it, has it got worse since, and is anything unsafe right now?"
              value={form.description} onChange={update('description')} />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="unitNumber">Your address</label>
              <input id="unitNumber" placeholder="12 Pondview Terrace" value={form.unitNumber} onChange={update('unitNumber')} />
            </div>
            <div className="field">
              <label htmlFor="locationDetails">Where is it?</label>
              <input id="locationDetails" placeholder="By the mailboxes"
                value={form.locationDetails} onChange={update('locationDetails')} />
            </div>
          </div>

          <div className="actions">
            <button type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit request'}
            </button>
            <button type="button" className="secondary" onClick={() => navigate(-1)}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
