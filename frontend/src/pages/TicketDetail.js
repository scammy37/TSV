import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { api, errorMessage } from '../api/client';
import useMeta from '../hooks/useMeta';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import { StatusBadge, PriorityBadge, AgeBadge, formatAge } from '../components/Badges';
import { useAuth } from '../context/AuthContext';
import { formatDateTime, formatRelative, humanize } from '../utils/format';

const TERMINAL = ['closed', 'cancelled'];

/** Renders one audit-trail entry as a sentence. */
function ActivityLine({ entry }) {
  const who = entry.actor?.fullName || 'Someone';

  let text;
  if (entry.action === 'created') text = `${who} submitted the ticket`;
  else if (entry.action === 'assigned') text = `${who} changed the assignee`;
  else if (entry.action === 'unassigned') text = `${who} removed the assignee`;
  else if (entry.action === 'commented') text = `${who} added a comment`;
  else if (entry.action === 'commented_internal') text = `${who} added an internal note`;
  else if (entry.field) {
    text = `${who} changed ${humanize(entry.field).toLowerCase()} from "${humanize(entry.oldValue)}" to "${humanize(entry.newValue)}"`;
  } else text = `${who} ${entry.action}`;

  return (
    <li className="activity-item">
      <span className="activity-dot" />
      <span>
        {text}
        <br />
        <span className="activity-time" title={formatDateTime(entry.createdAt)}>
          {formatRelative(entry.createdAt)}
        </span>
      </span>
    </li>
  );
}

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isStaff, isManagement } = useAuth();
  const { meta } = useMeta();

  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [staff, setStaff] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // Deleting takes the comments and the audit trail with it, so the button
  // arms a confirmation rather than acting on the first click.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [draft, setDraft] = useState('');
  const [draftInternal, setDraftInternal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [loadedTicket, loadedComments, loadedActivity] = await Promise.all([
        api.getTicket(id),
        api.listComments(id),
        api.listActivity(id),
      ]);
      setTicket(loadedTicket);
      setComments(loadedComments);
      setActivity(loadedActivity);
      setResolutionNotes(loadedTicket.resolutionNotes || '');
    } catch (err) {
      setError(errorMessage(err, 'Could not load this ticket'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isStaff) api.assignableUsers().then(setStaff).catch(() => setStaff([]));
  }, [isStaff]);

  // Refreshes the ticket and its audit trail after any mutation.
  const refresh = useCallback(async () => {
    const [loadedTicket, loadedActivity] = await Promise.all([
      api.getTicket(id), api.listActivity(id),
    ]);
    setTicket(loadedTicket);
    setActivity(loadedActivity);
  }, [id]);

  const mutate = async (fn, successMessage) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      await refresh();
      if (successMessage) setNotice(successMessage);
    } catch (err) {
      setError(errorMessage(err, 'Could not update the ticket'));
    } finally {
      setBusy(false);
    }
  };

  const handleComment = async (event) => {
    event.preventDefault();
    if (!draft.trim()) return;

    setBusy(true);
    setError('');
    try {
      const created = await api.addComment(id, { comment: draft, isInternal: draftInternal });
      setComments((current) => [...current, created]);
      setDraft('');
      setDraftInternal(false);
      await refresh();
    } catch (err) {
      setError(errorMessage(err, 'Could not post the comment'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    setError('');
    try {
      await api.deleteTicket(id);
      // The ticket this page is built on is gone, so there is nothing to
      // refresh -- leave for the queue instead.
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the ticket'));
      setBusy(false);
      setConfirmingDelete(false);
    }
  };

  if (loading) return <Spinner center />;

  if (!ticket) {
    return (
      <div className="card">
        <Alert>{error || 'Ticket not found'}</Alert>
        <Link to="/dashboard">Back to the list</Link>
      </div>
    );
  }

  const nextStatuses = meta?.nextStatuses?.[ticket.status] || [];
  const isClosed = TERMINAL.includes(ticket.status);
  // Closing is how a request is finished, and the closing email asks the
  // homeowner to say if it is not actually fixed, so a closed ticket still
  // takes replies. Cancelled is the end of the conversation.
  const canComment = isStaff || ticket.status !== 'cancelled';

  return (
    <>
      <div className="page-head">
        <div>
          <div className="ticket-row-top">
            <span className="ticket-number">{ticket.ticketNumber}</span>
            <StatusBadge status={ticket.status} label={meta?.statusLabels?.[ticket.status]} />
            <PriorityBadge priority={ticket.priority} label={meta?.priorityLabels?.[ticket.priority]} />
            <AgeBadge hours={ticket.ageHours} agingDays={meta?.agingDays} />
          </div>
          <h1 style={{ marginTop: 6 }}>{ticket.title}</h1>
          <p>
            Opened {formatRelative(ticket.createdAt)} by {ticket.homeowner?.fullName}
            {ticket.unitNumber ? ` · ${ticket.unitNumber}` : ''}
          </p>
        </div>
        <div className="rowactions">
          <Link to="/dashboard"><button type="button" className="secondary">Back to list</button></Link>
          {isManagement && (
            confirmingDelete ? (
              <>
                <button type="button" className="danger" disabled={busy} onClick={handleDelete}>
                  {busy ? 'Deleting...' : 'Delete for good'}
                </button>
                <button type="button" className="secondary" disabled={busy}
                  onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className="secondary" disabled={busy}
                title="Remove this ticket, its comments and its history"
                onClick={() => setConfirmingDelete(true)}>
                Delete
              </button>
            )
          )}
        </div>
      </div>

      <Alert onDismiss={() => setError('')}>{error}</Alert>
      <Alert kind="success" onDismiss={() => setNotice('')}>{notice}</Alert>

      <div className="detail-grid">
        <div>
          <div className="card">
            <h3>Description</h3>
            <p className="detail-desc">{ticket.description}</p>
            {ticket.locationDetails && (
              <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>
                <strong>Location:</strong> {ticket.locationDetails}
              </p>
            )}
          </div>

          {ticket.resolutionNotes && (
            <div className="card">
              <h3>Resolution</h3>
              <p className="detail-desc">{ticket.resolutionNotes}</p>
            </div>
          )}

          <div className="card">
            <div className="card-head">
              <h3>Conversation</h3>
              <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>
                {comments.length} {comments.length === 1 ? 'message' : 'messages'}
              </span>
            </div>

            {comments.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>
                No messages yet. {isStaff ? 'Reply to let the homeowner know where things stand.' : 'Add a note if anything changes.'}
              </p>
            ) : (
              <div className="comment-list">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`comment${comment.isInternal ? ' internal' : ''}${comment.author?.id === user?.id ? ' mine' : ''}`}
                  >
                    <div className="comment-head">
                      <span className="comment-author">{comment.author?.fullName || 'Removed user'}</span>
                      {comment.isInternal && <span className="badge badge-internal">Internal</span>}
                      <span className="comment-time" title={formatDateTime(comment.createdAt)}>
                        {formatRelative(comment.createdAt)}
                      </span>
                    </div>
                    <p className="comment-body">{comment.comment}</p>
                  </div>
                ))}
              </div>
            )}

            {canComment ? (
              <form onSubmit={handleComment}>
                <div className="field">
                  <label htmlFor="comment">Add a message</label>
                  <textarea id="comment" rows={3} value={draft}
                    placeholder={isStaff ? 'Reply to the homeowner...' : 'Add more detail...'}
                    onChange={(e) => setDraft(e.target.value)} />
                </div>

                {isStaff && (
                  <label className="checkbox" style={{ display: 'block', marginBottom: 12 }}>
                    <input type="checkbox" checked={draftInternal}
                      onChange={(e) => setDraftInternal(e.target.checked)} />
                    Internal note &mdash; hidden from the homeowner
                  </label>
                )}

                <div className="actions" style={{ alignItems: 'center' }}>
                  <button type="submit" disabled={busy || !draft.trim()}>
                    {/* The label names what the click will do, so the mode is
                        impossible to miss at the moment of posting. */}
                    {busy ? 'Posting...' : (draftInternal ? 'Post internal note' : 'Post message')}
                  </button>
                </div>
              </form>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>
                This ticket is closed. Submit a new request if the problem comes back.
              </p>
            )}
          </div>

          <div className="card">
            <h3>Activity</h3>
            <ul className="activity-list">
              {activity.map((entry) => <ActivityLine key={entry.id} entry={entry} />)}
            </ul>
          </div>
        </div>

        <div>
          <div className="card">
            <h3>Details</h3>
            <div className="meta-list">
              <div className="meta-item">
                <span className="meta-label">Category</span>
                <span className="meta-value">{ticket.categoryName}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Assigned to</span>
                <span className="meta-value">{ticket.assignee?.fullName || 'Nobody yet'}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Open for</span>
                <span className="meta-value">{formatAge(ticket.ageHours)}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Submitted by</span>
                <span className="meta-value">
                  {ticket.homeowner?.fullName}
                  {isStaff && ticket.homeowner?.email ? ` · ${ticket.homeowner.email}` : ''}
                </span>
              </div>
              {ticket.firstResponseAt && (
                <div className="meta-item">
                  <span className="meta-label">First response</span>
                  <span className="meta-value">{formatRelative(ticket.firstResponseAt)}</span>
                </div>
              )}
              {ticket.resolvedAt && (
                <div className="meta-item">
                  <span className="meta-label">Completed</span>
                  <span className="meta-value">{formatRelative(ticket.resolvedAt)}</span>
                </div>
              )}
              <div className="meta-item">
                <span className="meta-label">Last updated</span>
                <span className="meta-value">{formatRelative(ticket.updatedAt)}</span>
              </div>
            </div>
          </div>

          {isStaff && (
            <div className="card">
              <h3>Triage</h3>

              <div className="field">
                <label htmlFor="assignee">Assignee</label>
                <select id="assignee" disabled={busy} value={ticket.assignee?.id || ''}
                  onChange={(e) => {
                    const value = e.target.value ? Number(e.target.value) : null;
                    mutate(() => api.assignTicket(ticket.id, value), 'Assignment updated');
                  }}>
                  <option value="">Unassigned</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.openTicketCount} open)
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="priority">Priority</label>
                <select id="priority" disabled={busy} value={ticket.priority}
                  onChange={(e) => mutate(
                    () => api.updateTicket(ticket.id, { priority: e.target.value }),
                    'Priority updated',
                  )}>
                  {meta?.priorities.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Move to</label>
                <div className="actions">
                  {nextStatuses.length === 0 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                      No further transitions available.
                    </span>
                  )}
                  {nextStatuses.map((status) => (
                    <button
                      key={status}
                      type="button"
                      className="secondary sm"
                      disabled={busy}
                      onClick={() => mutate(
                        () => api.updateTicket(ticket.id, {
                          status,
                          // Carry the notes along when resolving.
                          ...(status === 'closed' && resolutionNotes ? { resolutionNotes } : {}),
                        }),
                        `Moved to ${meta?.statusLabels?.[status] || status}`,
                      )}
                    >
                      {meta?.statusLabels?.[status] || status}
                    </button>
                  ))}
                </div>
              </div>

              {!isClosed && (
                <div className="field" style={{ marginTop: 14 }}>
                  <label htmlFor="resolutionNotes">Resolution notes</label>
                  <textarea id="resolutionNotes" rows={3}
                    placeholder="What was done to fix it?"
                    value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} />
                  <div className="field-hint">
                    Included in the homeowner email when you close this ticket.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
