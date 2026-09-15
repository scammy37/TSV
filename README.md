# Ticket System for Property Management

A comprehensive ticket/work order management system for apartment complexes. Homeowners can submit service requests, track status, and communicate with management. Management can triage, assign, and resolve tickets efficiently.

## Project Structure

```
/frontend          - React application (homeowner & management portals)
/backend           - Node.js/Express API server
/database          - PostgreSQL schema and migrations
/docs              - Documentation
```

## Tech Stack

- **Frontend**: React, Axios, Material-UI
- **Backend**: Node.js, Express, JWT Authentication
- **Database**: PostgreSQL
- **Email**: Gmail SMTP
- **Hosting**: Scalable architecture ready for deployment

## Features

### Homeowner Portal
- Submit service requests
- Track ticket status in real-time
- Add notes and communicate with management
- View ticket history
- Receive email notifications

### Management Portal
- View all incoming tickets
- Triage and prioritize requests
- Assign tickets to staff
- Update status and add notes
- Track SLAs and deadlines
- Communication with homeowners
- Generate reports

### Core Features
- Role-based access control (Homeowner/Management)
- JWT authentication
- Email notifications on all actions
- Priority levels (Low, Medium, High, Urgent)
- Service categories
- SLA tracking
- Staff assignment
- Audit trail/activity log

## Getting Started

### Prerequisites
- Node.js (v16+)
- PostgreSQL (v12+)
- npm or yarn

### Installation

1. Clone the repository
2. Follow setup instructions in `/backend/README.md`
3. Follow setup instructions in `/frontend/README.md`
4. Configure environment variables
5. Run database migrations
6. Start both servers

## Development

See individual README files in `/frontend` and `/backend` directories.

## License

MIT
