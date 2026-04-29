# Insighta Labs Backend – Secure Access & Multi‑Interface Integration (Stage 3)

## Overview

This is the production backend for Insighta Labs+, a demographic intelligence platform. It builds on Stage 2 by adding:

- GitHub OAuth with PKCE (web + CLI)
- Access & refresh tokens (JWT, short expiry)
- Role‑based access control (admin / analyst)
- API versioning (`X-API-Version: 1`)
- Pagination links (`total_pages`, `self`, `next`, `prev`)
- CSV profile export
- Rate limiting & request logging
- Deployed on Vercel

All Stage 2 features (filtering, sorting, pagination, natural language search) remain intact.

## Live URL

**Backend** – [https://build-insighta-labs-secure-access-m.vercel.app](https://build-insighta-labs-secure-access-m.vercel.app)

## System Architecture

- **Runtime**: Node.js 20+ / Express
- **Database**: MongoDB Atlas + Mongoose
- **Authentication**: GitHub OAuth with PKCE (Proof Key for Code Exchange)
- **Token management**: JWT access tokens (3 min), refresh tokens (5 min, stored in DB)
- **Deployment**: Vercel (serverless functions)
- **Structure**: Clean architecture – controllers, services, models, routes, middleware

## Authentication Flow (OAuth + PKCE)

### For Web Portal (HTTP‑only cookies)

1. User clicks “Continue with GitHub” → `GET /auth/github`.
2. Backend generates a `state` and redirects to GitHub.
3. User authorises on GitHub; GitHub redirects to `GET /auth/github/callback` with `code` and `state`.
4. Backend exchanges `code` for a GitHub access token (no PKCE for web flow).
5. Backend fetches user info, creates/updates a local user, and issues:
   - `access_token` (JWT, expires 3 min)
   - `refresh_token` (random, expires 5 min, stored in DB)
6. Both tokens are set as `httpOnly` cookies and the user is redirected to the web portal dashboard.

### For CLI (PKCE + polling)

1. `insighta login` generates `code_verifier`, `code_challenge` and `state`.
2. CLI opens browser to `GET /auth/github?state=...&code_challenge=...&code_verifier=...`.
3. Backend stores `code_verifier` in `OAuthState` collection (expires after 5 min).
4. User authorises; GitHub redirects to `/auth/github/callback` with `code` and `state`.
5. Backend retrieves `code_verifier` using `state`, exchanges `code + code_verifier` for GitHub token.
6. Backend creates local user, issues access + refresh tokens, and stores them in `AuthSession` keyed by `state`.
7. CLI polls `GET /auth/token?state=...` every 2 seconds until tokens are ready, then stores them locally.

## Token Lifecycle

| Token | Expiry | Storage | Renewal |
|-------|--------|---------|---------|
| Access token (JWT) | 3 minutes | Cookie (web) or local file (CLI) | Using refresh token via `POST /auth/refresh` |
| Refresh token | 5 minutes | DB + cookie (web) / local file (CLI) | Invalidated after use; new pair issued |

- **Web**: refresh token is `httpOnly` cookie, renewed automatically on expiry.
- **CLI**: auto‑refresh on 401 responses; if refresh fails, user must re‑run `insighta login`.

## Role‑Based Access Control (RBAC)

Two roles are enforced by middleware on every `/api/*` endpoint:

| Role   | Permissions                                                                 |
|--------|-----------------------------------------------------------------------------|
| Admin  | Full access: `POST /api/profiles`, `DELETE /api/profiles/:id`, all `GET`    |
| Analyst| Read‑only: all `GET` endpoints (`/api/profiles`, `/api/profiles/:id`, `/api/profiles/search`, `/api/profiles/export`) |

Default role for new users is `analyst`.  
If `is_active` is `false`, all requests return `403 Forbidden`.

## API Versioning

All requests to `/api/*` must include the header:
X-API-Version: 1

text

Missing or invalid version → `400 Bad Request` with:
```json
{ "status": "error", "message": "API version header required" }
Updated Pagination (Stage 3)
GET /api/profiles and GET /api/profiles/search now return:

json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 2026,
  "total_pages": 203,
  "links": {
    "self": "/api/profiles?page=1&limit=10",
    "next": "/api/profiles?page=2&limit=10",
    "prev": null
  },
  "data": [ ... ]
}
CSV Export
Endpoint: GET /api/profiles/export?format=csv

Accepts the same filters, sorting and pagination parameters as GET /api/profiles (though pagination is ignored for export – all matching records are returned).

Response:

200 OK with Content-Type: text/csv

Content-Disposition: attachment; filename="profiles_<timestamp>.csv"

Columns: id,name,gender,gender_probability,age,age_group,country_id,country_name,country_probability,created_at

Example:

text
https://build-insighta-labs-secure-access-m.vercel.app/api/profiles/export?format=csv&gender=male&country_id=NG
Rate Limiting
Endpoint group	Limit (per minute)
/auth/*	10 requests
/api/* (authenticated)	60 requests per user
Exceeding the limit returns 429 Too Many Requests with:

json
{ "status": "error", "message": "Too many requests, please try again later." }
Logging
All requests are logged using Morgan (combined format) to stdout (visible in Vercel logs).

Natural Language Search (unchanged from Stage 2)
Rule‑based parser (no AI) for queries like "young males from nigeria".
See the Stage 2 README for full details.
Limitations: no boolean logic, no negation, single country only, limited country name mapping.

Repository
GitHub: https://github.com/Kpellehboy/Build-Insighta-Labs-Secure-Access-Multi-Interface-Integration.git

Related Repositories
CLI tool: https://github.com/Kpellehboy/insighta-cli.git

Web portal: https://github.com/Kpellehboy/insighta-web.git

Environment Variables (required on Vercel)
Variable	Example
MONGODB_URI	mongodb+srv://user:pass@cluster.mongodb.net/profileDB
GITHUB_CLIENT_ID: " "
GITHUB_CLIENT_SECRET " "
GITHUB_CALLBACK_URL	https://build-insighta-labs-secure-access-m.vercel.app/auth/github/callback
JWT_SECRET	(long random string)
WEB_PORTAL_URL	https://insighta-web-mocha.vercel.app
NODE_ENV	production
Deployment (Vercel)
Root directory: . (the repo root containing src/ and package.json)

Build command: npm install

Output directory: not needed (Vercel defaults)

Author
Elijah M Flomo – Backend Engineering Intern
