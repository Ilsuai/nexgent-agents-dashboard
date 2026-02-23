# Nexgent Agents Dashboard

A dashboard for tracking and analyzing Nexgent AI trading agent performance — signals, trades, P&L, and analytics.

## Structure

```
nexgent-agents-dashboard/
├── frontend/          React + Vite dashboard (Firebase Hosting)
├── backend/           Express.js API server (Railway)
└── data/              CSV data files + Firestore importer
```

## Quick Start

### 1. Backend (Railway)
```bash
cd backend
cp .env.example .env   # fill in Firebase service account + user ID
npm install
npm run dev            # runs on http://localhost:3001
```

### 2. Frontend
```bash
cd frontend
cp .env.example .env.local   # fill in Firebase config
npm install
npm run dev            # runs on http://localhost:5173
```

### 3. Import CSV data into Firestore (one-time)
```bash
cd data
cp .env.example .env   # fill in Firebase service account + user ID
npm install
npm run import
```

## Deployment

### Backend → Railway
1. Push the `backend/` folder to a GitHub repo
2. Create a new Railway project from that repo
3. Set environment variables in Railway dashboard:
   - `FIREBASE_SERVICE_ACCOUNT` (full JSON as string)
   - `FIREBASE_USER_ID`
   - `FRONTEND_URL` (your Firebase Hosting URL)

### Frontend → Firebase Hosting
```bash
cd frontend
npm run build
firebase deploy --only hosting
```
Make sure to set `VITE_API_URL` to your Railway backend URL before building.

## Environment Variables

### Backend (`backend/.env`)
| Variable | Description |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Admin SDK service account JSON |
| `FIREBASE_USER_ID` | Firestore user document ID |
| `FRONTEND_URL` | Allowed frontend origin for CORS |

### Frontend (`frontend/.env.local`)
| Variable | Description |
|---|---|
| `VITE_FIREBASE_*` | Firebase client SDK config |
| `VITE_API_URL` | Railway backend URL |
