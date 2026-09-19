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
          <h1>New service request</h1>
          <p>Tell us what needs attention and we will assign it to the right person.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <Alert>{error}</Alert>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="title">What is the problem?</label>
            <input id="title" required minLength={5} maxLength={255}
              placeholder="Kitchen sink is leaking"
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
              placeholder="When did it start, what have you tried, and is it getting worse?"
              value={form.description} onChange={update('description')} />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="unitNumber">Unit number</label>
              <input id="unitNumber" value={form.unitNumber} onChange={update('unitNumber')} />
            </div>
            <div className="field">
              <label htmlFor="locationDetails">Where in the unit?</label>
              <input id="locationDetails" placeholder="Under the kitchen sink"
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
