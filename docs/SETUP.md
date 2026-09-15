# Local Development Setup

## Prerequisites
- Node.js 16+
- PostgreSQL 12+
- Git

## Backend Setup

1. cd backend
2. npm install
3. cp .env.example .env
4. Configure .env with your database and email settings
5. npm run dev

## Frontend Setup

1. cd frontend
2. npm install
3. cp .env.example .env
4. npm start

## Database Setup

1. createdb tsv_db
2. psql -U postgres -d tsv_db -f backend/db/schema.sql
