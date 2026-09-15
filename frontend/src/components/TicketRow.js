import React from 'react';
import { Link } from 'react-router-dom';

import { StatusBadge, PriorityBadge, OverdueBadge } from './Badges';
import { formatRelative } from '../utils/format';

export default function TicketRow({ ticket, labels, showHomeowner }) {
  return (
    <Link to={`/tickets/${ticket.id}`} className={`ticket-row p-${ticket.priority}`}>
      <div className="ticket-row-top">
        <span className="ticket-number">{ticket.ticketNumber}</span>
        <StatusBadge status={ticket.status} label={labels?.statuses?.[ticket.status]} />
        <PriorityBadge priority={ticket.priority} label={labels?.priorities?.[ticket.priority]} />
        {ticket.isOverdue && <OverdueBadge when={ticket.slaDeadline} />}
      </div>

      <div className="ticket-title">{ticket.title}</div>

      <div className="ticket-meta">
        <span>{ticket.categoryName}</span>
        <span className="sep">·</span>
        <span>Opened {formatRelative(ticket.createdAt)}</span>
        {showHomeowner && ticket.homeowner && (
          <>
            <span className="sep">·</span>
            <span>
              {ticket.homeowner.fullName}
              {ticket.homeowner.unitNumber ? ` (Unit ${ticket.homeowner.unitNumber})` : ''}
            </span>
          </>
        )}
        <span className="sep">·</span>
        <span>{ticket.assignee ? `Assigned to ${ticket.assignee.fullName}` : 'Unassigned'}</span>
      </div>
    </Link>
  );
}
