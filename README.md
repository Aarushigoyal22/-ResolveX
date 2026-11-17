# ResolveX – Intelligent Incident & Service Request Management Platform

React · Node.js · Express · PostgreSQL · JWT · Docker

## Run with Docker (easiest)
```bash
docker compose up --build
# in a second terminal, load demo data:
docker compose exec api node src/db/seed.js
```
Open http://localhost:8080

## Run locally
```bash
# 1. Postgres
docker run -d --name rx-db -p 5432:5432 -e POSTGRES_USER=resolvex -e POSTGRES_PASSWORD=resolvex -e POSTGRES_DB=resolvex postgres:16-alpine

# 2. API
cd backend && cp .env.example .env && npm install
npm run migrate && npm run seed && npm run dev

# 3. Web (new terminal)
cd frontend && npm install && npm run dev      # http://localhost:5173
```

Demo logins (password `password123`): `admin@resolvex.dev`, `asha@resolvex.dev` (agent), `user@resolvex.dev`.

## How each resume bullet maps to code
| Bullet | Where |
|---|---|
| Ticket lifecycle | `backend/src/routes/tickets.js` (`TRANSITIONS`: open → assigned → in_progress → resolved → closed, reopen allowed) |
| RBAC + workload-aware assignment | `middleware/auth.js` (`authorize`), `services/assignment.js` (fewest active tickets, available agents only) |
| SLA monitoring + escalation | `services/sla.js` (SLA hours per priority; sweeper bumps priority, resets the due date, writes to `ticket_history`) |
| REST APIs + indexed schema | `routes/*.js`, `db/schema.sql` (composite and partial indexes) |
| Analytics dashboard | `routes/analytics.js` + `frontend/src/pages/Dashboard.jsx` |

## API summary
| Method | Path | Role |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | public |
| GET | /api/tickets?status=&priority=&overdue=true&assigned_to=me&q=&page= | all (users see only their own) |
| POST | /api/tickets | all (auto-assigns) |
| GET | /api/tickets/:id | owner / staff |
| PATCH | /api/tickets/:id/status | assigned agent / admin |
| PATCH | /api/tickets/:id/assign | admin |
| POST | /api/tickets/:id/comments | owner / staff |
| GET | /api/users/agents | staff |
| PATCH | /api/users/:id/availability | self / admin |
| GET | /api/analytics/summary | staff |

## Ideas to extend
Email/Slack alerts on escalation, file attachments, WebSocket live updates, pagination cursors, unit tests (Jest + Supertest), GitHub Actions CI.
