# Stage 2 – Intelligence Query Engine

## Overview

This API extends the Stage 1 profile storage system with advanced query capabilities: filtering, sorting, pagination, and a natural language search endpoint. It serves demographic intelligence data for Insighta Labs.

## Base URL

`https://stage-1-task-data-persistence-api-d.vercel.app`

## Endpoints

| Method | Endpoint                     | Description |
|--------|------------------------------|-------------|
| POST   | `/api/profiles`              | Create a new profile (idempotent) |
| GET    | `/api/profiles/:id`          | Retrieve a single profile by UUID v7 |
| GET    | `/api/profiles`              | List profiles with filtering, sorting, pagination |
| DELETE | `/api/profiles/:id`          | Delete a profile |
| GET    | `/api/profiles/search`       | Natural language query |

---

## Enhanced `GET /api/profiles`

Supports the following query parameters (all optional):

### Filters
- `gender` – `male` or `female`
- `age_group` – `child`, `teenager`, `adult`, `senior`
- `country_id` – two‑letter ISO code (e.g., `NG`, `KE`)
- `min_age` – integer, minimum age
- `max_age` – integer, maximum age
- `min_gender_probability` – float (0–1)
- `min_country_probability` – float (0–1)

### Sorting
- `sort_by` – `age`, `created_at`, `gender_probability`
- `order` – `asc` or `desc` (default `desc` for `created_at`)

### Pagination
- `page` – default `1`
- `limit` – default `10`, maximum `50`

**Example request:**
```
GET /api/profiles/019dabc1-b221-742f-a00d-fb0f4dc7db15
```
<img width="369" height="271" alt="image" src="https://github.com/user-attachments/assets/4254af1e-2c7b-4333-ad3c-453c0852d265" />

**Example response (200 OK):**
```json
{
  "status": "success",
  "page": 2,
  "limit": 10,
  "total": 2026,
  "data": [ ... ]
}
```

---

## Natural Language Search `GET /api/profiles/search`

Converts plain English queries into structured filters using rule‑based parsing (no AI/LLM).

**Example:**
```
GET /api/profiles/search?q=young males from nigeria&page=1&limit=10
```

### Parsing Approach

The parser uses regex and keyword matching in the following order:

1. **Gender** – looks for `male` or `female`.
2. **Age group / age range** –  
   - `young` → `min_age=16`, `max_age=24` (for parsing only, not stored as age group)  
   - `teenager` / `teens` → `age_group=teenager`  
   - `adult` → `age_group=adult`  
   - `senior` / `old` → `age_group=senior`  
   - `child` / `kid` → `age_group=child`  
   - `above X` → `min_age=X`  
   - `below X` → `max_age=X`
3. **Country** – matches `from <country_name>` using a mapping table of common country names to ISO codes (e.g., `nigeria` → `NG`). Only exact lower‑case matches are supported.

If multiple rules match, they are combined (AND logic). If the query cannot be interpreted, the API returns:

```json
{ "status": "error", "message": "Unable to interpret query" }
```

### Supported Keywords & Mappings

| Keyword          | Mapped Filter                          |
|------------------|----------------------------------------|
| `male`           | `gender=male`                          |
| `female`         | `gender=female`                        |
| `young`          | `min_age=16`, `max_age=24`             |
| `teenager`/`teens` | `age_group=teenager`                 |
| `adult`          | `age_group=adult`                      |
| `senior`/`old`   | `age_group=senior`                     |
| `child`/`kid`    | `age_group=child`                      |
| `above X`        | `min_age=X`                            |
| `below X`        | `max_age=X`                            |
| `from <country>` | `country_id=<ISO_CODE>` (mapping)      |

### Country Name Mapping (partial list)

| Country name      | ISO code |
|-------------------|----------|
| nigeria           | NG       |
| kenya             | KE       |
| south africa      | ZA       |
| ghana             | GH       |
| angola            | AO       |
| rwanda            | RW       |
| ethiopia          | ET       |
| senegal           | SN       |
| mali              | ML       |
| benin             | BJ       |
| liberia           | LR       |

---

## Limitations of the Natural Language Parser

The parser is intentionally simple and **does not** handle:

- **Complex boolean logic** – `AND` / `OR` combinations (e.g., `males from nigeria or kenya`).
- **Negation** – `not male` or `except teenagers`.
- **Age ranges expressed as phrases** – `ages 20 to 30` (only `above`/`below`).
- **Multiple countries** – only the first `from <country>` is used.
- **Plurals or misspellings** – must use exact keywords as listed.
- **Inference of age group from age numbers** – e.g., `age 25` will not set `age_group=adult` (but min/max age filters still work).
- **Names or non‑demographic terms** – queries that contain only a name (e.g., `Elijah M Flomo`) return an error.
- **Case sensitivity** – all matching is case‑insensitive, but country names must be spelled correctly.

These limitations are intentional to keep the parser predictable and fast for a limited set of demographic queries.

---

## Data Seeding

The database is pre‑seeded with 2026 profiles from `seed_profiles.json`. To run the seed script:

```bash
npm run seed
```

The script upserts by `name`, so re‑running does not create duplicates.

---

## Error Handling

All errors follow the structure:

```json
{ "status": "error", "message": "<description>" }
```

Common status codes:
- `400` – missing or invalid parameter, uninterpretable query
- `404` – profile not found
- `422` – invalid parameter type
- `502` – external API failure (only on POST)
- `500` – internal server error

Invalid query parameters (e.g., `?invalid=foo`) return `400` with `"Invalid query parameters"`.

---

## CORS

`Access-Control-Allow-Origin: *` is enabled for all routes.

---

## Tech Stack

- Node.js 20+ / Express
- MongoDB Atlas + Mongoose
- UUID v7 for primary keys
- Deployed on Vercel (serverless functions)

---

## GitHub Repository

https://github.com/Kpellehboy/Stage-1-Task-Data-Persistence-API-Design-Assessment.git

Vercel Deployment url: https://stage-1-task-data-persistence-api-d.vercel.app/

---

## Author

Elijah M Flomo – Backend Engineering Intern

*Built for Insighta Labs – Stage 2 Assessment*
```

Copy this entire block into your `README.md` file, commit, and push. The grader will check for the required sections (parsing approach and limitations). Good luck with your submission!
