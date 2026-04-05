# Academic Burnout Early Warning System (Explainable Behavioral Analytics)

Production-oriented full-stack demo that proactively flags student academic burnout risk using only behavioral academic data.

## Architecture

- **Frontend:** React + Vite + Tailwind CSS + Recharts
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Analytics:** Rule-based, trend-sensitive explainable scoring pipeline
- **Future Integration:** `backend/src/services/dataService.js` acts as an abstraction for ERP/LMS adapters

## Key Features

- Burnout risk classification: **Low / Medium / High**
- Explainable outputs with contributing factors and trend summaries
- Behavioral indicators:
  - Attendance Consistency Score
  - Assignment Delay Trend
  - Deadline Miss Frequency
  - Performance Stability Index
- Mentor dashboard with risk filter and high-risk alerts
- Student detail analytics charts + timeline + intervention notes
- Admin panel to assign mentors to students
- Demo dataset generator (72 students × 10 weeks)
- Basic role-based access (`mentor`, `admin`) via mock headers

## Project Structure

```text
/backend
  /src
    /controllers
    /routes
    /services
    /models
    /utils
    /config
    /scripts
  /sql

/frontend
  /src
    /components
    /pages
    /services
    /utils
```

## Database Schema (PostgreSQL)

Main tables:
- `mentors`
- `students`
- `weekly_behavior`
- `interventions`

See full DDL in: `backend/sql/schema.sql`.

## Local Setup

### 1) Prerequisites
- Node.js 20+
- PostgreSQL 14+

### 2) Create database

```sql
CREATE DATABASE burnout_ews;
```

### 3) Environment
Create `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/burnout_ews
PORT=4000
```

### 4) Install dependencies

```bash
npm run install:all
```

### 5) Initialize and seed database

```bash
npm run db:init
npm run db:seed
```

### 6) Run both frontend and backend

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

## Mock Role-Based Access Control

The backend reads headers:
- `x-role`: `mentor` or `admin`
- `x-user-id`: numeric id

Examples:
- Mentor (assigned students only): `x-role: mentor`, `x-user-id: 1`
- Admin (all students + assignment actions): `x-role: admin`, `x-user-id: 99`

## API Endpoints

- `GET /students`
- `GET /students/:id`
- `GET /students/:id/analytics`
- `GET /students/:id/risk`
- `POST /intervention`
- `GET /mentor/dashboard`
- `GET /admin/mentors` (admin)
- `POST /admin/assign-mentor` (admin)

## Sample API Responses

### `GET /students/:id/risk`

```json
{
  "studentId": 12,
  "indicators": {
    "attendanceConsistencyScore": 61.2,
    "assignmentDelayTrend": "increasing",
    "assignmentDelaySlope": 2.14,
    "deadlineMissFrequency": 1.8,
    "performanceStabilityIndex": 69.5,
    "attendanceDropPct": 28.7,
    "performanceDropPct": 17.1,
    "riskScore": 73.2,
    "anomalies": [
      {
        "weekStart": "2026-03-16",
        "reason": "Unusually high missed deadlines or assignment delay"
      }
    ]
  },
  "level": "High",
  "explanation": "High risk due to 28.7% drop in attendance over tracked period, assignment delay trend is increasing, average 1.8 missed deadlines per week, performance scores are unstable.",
  "contributingFactors": [
    "28.7% drop in attendance over tracked period",
    "assignment delay trend is increasing",
    "average 1.8 missed deadlines per week",
    "performance scores are unstable"
  ]
}
```

### `GET /mentor/dashboard`

```json
{
  "mentorId": 1,
  "riskBuckets": { "Low": 6, "Medium": 7, "High": 5 },
  "alerts": [
    {
      "studentId": 41,
      "studentName": "Jordan Lee 41",
      "message": "High risk student detected: Jordan Lee 41"
    }
  ],
  "students": [
    {
      "id": 1,
      "name": "Alex Brown 1",
      "riskLevel": "Medium",
      "riskScore": 53.7,
      "explanation": "Medium risk due to assignment delay trend is increasing."
    }
  ]
}
```

## Explainability Model Logic

1. Compute indicators from 8–12 week time series.
2. Apply weighted risk score model (0–100).
3. Apply explicit thresholds to classify Low/Medium/High.
4. Generate human-readable explanation text from detected factors.
5. Include anomaly flags when abrupt behavior changes are detected.

This ensures **no black-box-only output** and traceable predictions for mentors/admins.
