# Profile API – Backend Engineering Internship Project

A production‑ready REST API that accepts a name, enriches it with external APIs (Genderize, Agify, Nationalize), classifies the age group, stores the result in MongoDB, and exposes CRUD endpoints. Built with **Node.js**, **Express**, **MongoDB (Mongoose)**, and deployed on **Vercel** as serverless functions.

## Features

- ✅ Idempotent `POST /api/profiles` – same name always returns the same profile.
- ✅ Parallel calls to Genderize, Agify, Nationalize APIs.
- ✅ Age group classification: `child` (0‑12), `teenager` (13‑19), `adult` (20‑59), `senior` (60+).
- ✅ UUID v7 as primary key (time‑ordered, index‑friendly).
- ✅ ISO 8601 UTC timestamps.
- ✅ Case‑insensitive duplicate prevention via unique index on `normalizedName`.
- ✅ Filtering on `GET /api/profiles`: `gender`, `country_id`, `age_group`.
- ✅ Global error handling + CORS enabled.
- ✅ Deployable to Vercel (serverless) or any Node.js hosting.

## Tech Stack

| Layer       | Technology                     |
|-------------|--------------------------------|
| Runtime     | Node.js 20.x                   |
| Framework   | Express                        |
| Database    | MongoDB Atlas (or local)       |
| ODM         | Mongoose                       |
| External API calls | Axios                   |
| ID generation | UUID v7                     |
| Deployment  | Vercel (serverless functions)  |

## Project Structure
project-root/
├── api/
│ └── index.js # Vercel serverless entry point
├── src/
│ ├── config/
│ │ └── db.js # MongoDB connection
│ ├── controllers/
│ │ └── profileController.js
│ ├── models/
│ │ └── Profile.js # Mongoose schema (UUID v7, unique name)
│ ├── routes/
│ │ └── profileRoutes.js
│ ├── services/
│ │ └── externalApiService.js # Genderize, Agify, Nationalize calls
│ ├── utils/
│ │ └── classifier.js # ageGroup logic
│ ├── middleware/
│ │ └── errorHandler.js (optional, integrated in app.js)
│ └── app.js # Express app setup
├── .env # Environment variables (ignored by Git)
├── .gitignore
├── package.json
├── server.js # Local development entry point
├── vercel.json # Vercel deployment config
└── README.md

text

## Getting Started (Local Development)

### Prerequisites

- Node.js 20.x
- MongoDB Atlas account or local MongoDB instance
- Git

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
Install dependencies

bash
npm install
Set up environment variables

Create a .env file in the root directory:

env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/profileDB?retryWrites=true&w=majority
PORT=3000
Replace <username>, <password>, and <cluster> with your MongoDB Atlas credentials.

Start the development server

bash
npm run dev
You should see:

text
MongoDB Connected: ac-xxxxx-shard-00-00.xxxxx.mongodb.net
Server running on http://localhost:3000
API Endpoints
All endpoints are prefixed with /api/profiles. Base URL for local: http://localhost:3000; for production: https://your-project.vercel.app.

1. Create a profile (idempotent)
POST /api/profiles

Request body:

json
{
  "name": "John"
}
Response (201 Created – new profile):

json
{
  "id": "0190abcde-1234-7f00-9abc-1234567890ab",
  "name": "John",
  "gender": "male",
  "genderProbability": 0.99,
  "sampleSize": 1000,
  "age": 32,
  "ageGroup": "adult",
  "countryId": "US",
  "countryProbability": 0.85,
  "createdAt": "2026-04-15T12:34:56.789Z"
}
Response (200 OK – existing profile, idempotency): Same JSON body.

Errors:

Status	Condition
400	Missing or empty name
422	name is not a string
502	One of the external APIs fails (Genderize, Agify, Nationalize)
2. Get a profile by ID
GET /api/profiles/:id

Response (200 OK): Same profile JSON as above.

Errors:

Status	Condition
400	Invalid UUID v7 format
404	Profile not found
3. Get all profiles (with optional filters)
GET /api/profiles

Query parameters (all optional, case‑insensitive):

gender – male or female

country_id – two‑letter country code (e.g., US, fr)

age_group – child, teenager, adult, senior

Example:
GET /api/profiles?gender=male&country_id=US

Response (200 OK): Array of profile objects (sorted by createdAt descending). Empty array if none match.

4. Delete a profile
DELETE /api/profiles/:id

Response (204 No Content) – no response body.

Errors:

Status	Condition
400	Invalid UUID format
404	Profile not found
Deployment on Vercel
This project is configured to run as a serverless function on Vercel.

Steps
Push your code to a GitHub repository.

Log in to Vercel and import the repository.

Configure the project:

Framework Preset: Express

Root Directory: ./ (or project-root if you have a monorepo)

Build Command: npm run vercel-build (defined in package.json as npm install)

Output Directory: leave empty

Add environment variables:

MONGODB_URI – your MongoDB Atlas connection string (same as in .env)

PORT – optional (Vercel ignores it)

Deploy – Vercel will automatically build and deploy your API.

Important for MongoDB Atlas
Because Vercel functions use dynamic IP addresses, you must whitelist 0.0.0.0/0 (all IPs) in your MongoDB Atlas Network Access settings. For production, consider using Vercel’s MongoDB integration for VPC peering.

Testing
You can test the API with curl, Postman, or PowerShell.

Create a profile (PowerShell):

powershell
Invoke-RestMethod -Uri http://localhost:3000/api/profiles -Method POST -ContentType "application/json" -Body '{"name":"Alice"}' | ConvertTo-Json
Get all profiles (curl):

bash
curl https://your-project.vercel.app/api/profiles
Error Handling
All errors return a consistent JSON format:

json
{
  "error": "Human‑readable description"
}
The global error handler catches any unhandled exceptions and returns a 500 status.

Idempotency Guarantee
The normalizedName field (lowercase, trimmed) has a unique index in MongoDB.

Before creating a profile, the controller checks for an existing document with the same normalized name.

In case of a race condition, the unique index will throw a duplicate key error, which the controller catches and resolves by returning the existing profile.

Thus, multiple concurrent POST requests with the same name always return the same data without duplication.

Environment Variables
Variable	Required	Description
MONGODB_URI	Yes	MongoDB connection string (Atlas or local)
PORT	No	Port for local development (default 3000)
Scripts
Command	Description
npm run dev	Start local server with nodemon (hot reload)
npm start	Start local server without nodemon
npm run vercel-build	Installs dependencies (used by Vercel)
Common Mistakes & Solutions
Problem	Solution
uuidv7 is not a function	Update uuid package to version 11+ (npm install uuid@11).
MongoDB connection timeout on Vercel	Whitelist 0.0.0.0/0 in Atlas Network Access.
Route GET / not found	This is normal – the API has no root handler. Use /api/profiles.
Duplicate profiles created	Check that the unique index on normalizedName exists (Mongoose creates it automatically if unique: true).
Future Improvements
Add pagination (limit, skip) to GET /api/profiles.

Implement soft delete (deletedAt flag) instead of hard delete.

Add request validation middleware (Joi or Zod).

Write unit and integration tests (Jest).

Add JWT authentication.


Author
Elijah M Flomo – Backend Engineering Intern
