# 🕋 Umrah Trip Planner

A full-stack MERN app for planning an Umrah trip: pick a city and dates, choose a hotel near the Haram, see the full cost with VAT, track a preparation checklist and check expected crowd levels for each prayer. Available in **English and Arabic** with a fully mirrored right-to-left layout.

<!-- Live demo: add your Vercel URL here once deployed -->

## Screenshots

| Trip page (English) | Trip page (Arabic, RTL) |
| --- | --- |
| ![Trip page in English](docs/screenshots/trip-en.jpg) | ![Trip page in Arabic](docs/screenshots/trip-ar.jpg) |

| Dashboard | New trip wizard | Login |
| --- | --- | --- |
| _Add `docs/screenshots/dashboard.png`_ | _Add `docs/screenshots/wizard.png`_ | _Add `docs/screenshots/login.png`_ |

## Features

- **Accounts**: register and log in with email and password (bcrypt hashing, JWT auth). The token is stored in `localStorage` and attached by an Axios interceptor.
- **Hotels**: 8 seeded hotels in Makkah and Madinah with distance to the Haram, rating and nightly price in SAR.
- **3-step trip wizard**: city and dates → pick a hotel → review the cost breakdown.
- **Cost calculation** (server-side, unit tested):
  `total = nights × price per night × ceil(people / 2) rooms + 15% VAT`
- **Preparation checklist**: every new trip gets a default Umrah checklist (passport, visa, Nusuk permits, ihram, vaccinations…) that you can tick off.
- **Crowd levels** for every day of the trip and each of the five prayers:
  - **High**: Fridays, all of Ramadan (including the last 10 nights), and Maghrib/Isha
  - **Medium**: Fajr/Dhuhr on the weekend
  - **Low**: otherwise
  Ramadan is detected using the Umm al-Qura (Saudi) Hijri calendar built into Node's `Intl`.
- **Arabic and English** via react-i18next. Choosing Arabic sets `<html dir="rtl" lang="ar">`; the layout uses Tailwind logical properties (`ms-*`, `pe-*`, `text-start`, `border-s`) so it mirrors without duplicate styles. The language choice is saved in the browser and on the user's account.
- **Green and gold theme** with Inter and Noto Kufi Arabic fonts.

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS v4, React Router, Axios, i18next / react-i18next |
| Backend | Node.js, Express 5, Mongoose, JSON Web Tokens, bcryptjs, dotenv, cors |
| Database | MongoDB Atlas |
| Testing | Jest, Supertest |
| Hosting | Vercel (client and serverless API) |

## Project structure

```
umrah-trip-planner/
├── client/                 React + Vite app
│   ├── src/api/            Axios instance and interceptors
│   ├── src/components/     Layout, CrowdBadge, LanguageSwitcher, ProtectedRoute
│   ├── src/context/        AuthContext
│   ├── src/i18n/           i18next setup and en/ar translations
│   ├── src/pages/          Login, Register, Dashboard, NewTrip, TripDetail
│   └── vercel.json
├── server/                 Express API
│   ├── src/controllers/
│   ├── src/middleware/     JWT auth
│   ├── src/models/         User, Hotel, Trip
│   ├── src/routes/
│   ├── src/services/       costService, crowdService, checklistService
│   ├── api/index.js        Vercel serverless entry
│   ├── src/seed.js         Seeds 8 hotels
│   └── vercel.json
│   └── tests/              Jest tests
├── render.yaml             Optional Render blueprint for the API
└── docs/screenshots/
```

## Getting started

### Prerequisites

- Node.js 18+ (22 recommended)
- A free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

### 1. Install

```bash
git clone https://github.com/abeelmazhar/Umrah-Trip-Planner.git
cd Umrah-Trip-Planner
npm run install:all
```

### 2. Configure the server

```bash
cp server/.env.example server/.env
```

| Variable | Description |
| --- | --- |
| `PORT` | API port (default `5000`) |
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Long random string used to sign tokens |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |
| `CLIENT_ORIGIN` | Allowed CORS origin(s), comma-separated, e.g. `http://localhost:5173` |

In Atlas, add your IP address under **Network Access**.

### 3. Seed the hotels

```bash
npm run seed
```

### 4. Run

In two terminals:

```bash
npm run dev:server   # http://localhost:5000
npm run dev:client   # http://localhost:5173
```

In development Vite proxies `/api` to the server, so the client needs no environment variables. In production set `VITE_API_URL` (see `client/.env.example`).

### 5. Test

```bash
npm test
```

## API

All responses are JSON. 🔒 = requires `Authorization: Bearer <token>`.

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | | Health check |
| POST | `/api/auth/register` | | Body `{ name, email, password, preferredLanguage? }` → `{ token, user }` |
| POST | `/api/auth/login` | | Body `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | 🔒 | Current user |
| PATCH | `/api/auth/me` | 🔒 | Body `{ preferredLanguage: "en" \| "ar" }` |
| GET | `/api/hotels?city=Makkah` | | List hotels, optionally by city, nearest first |
| POST | `/api/trips/quote` | 🔒 | Price a trip without saving it → cost breakdown |
| POST | `/api/trips` | 🔒 | Body `{ city, startDate, endDate, people, hotelId }` → creates trip with cost and checklist |
| GET | `/api/trips` | 🔒 | List my trips |
| GET | `/api/trips/:id` | 🔒 | Get one of my trips |
| DELETE | `/api/trips/:id` | 🔒 | Delete one of my trips |
| PATCH | `/api/trips/:id/checklist/:itemId` | 🔒 | Body `{ done: true \| false }` |
| GET | `/api/crowd?date=YYYY-MM-DD&prayer=fajr` | | Crowd level. `prayer` is one of `fajr, dhuhr, asr, maghrib, isha`; omit it to get all five |

Example crowd response:

```json
{
  "date": "2026-11-28",
  "prayer": "fajr",
  "level": "Medium",
  "reasons": ["weekendPrayer"],
  "hijri": { "day": 18, "month": 6, "year": 1448 },
  "isRamadan": false,
  "isLastTenNights": false
}
```

## Deployment

Both the API and the client deploy to **Vercel** as two separate projects from this one repository (free, no card needed).

### API on Vercel (serverless)

`server/api/index.js` wraps the Express app as a Vercel serverless function, and `server/vercel.json` routes every path to it. The MongoDB connection is cached between invocations.

1. In [Vercel](https://vercel.com/new) import the repository and set **Root Directory** to `server`. Framework preset: **Other**.
2. Add environment variables:
   - `MONGO_URI`: your Atlas connection string
   - `JWT_SECRET`: a long random string
   - `JWT_EXPIRES_IN`: `7d`
   - `CLIENT_ORIGIN`: your client's Vercel URL (add it after deploying the client)
3. In Atlas → **Network Access**, allow `0.0.0.0/0` (Vercel functions have no fixed outbound IPs).
4. Seed the database once from your machine: `npm run seed` with the same `MONGO_URI` in `server/.env`.
5. Check `https://<your-api>.vercel.app/api/health` returns `{"status":"ok"}`.

### Client on Vercel

1. Import the repository again as a second project and set **Root Directory** to `client`. Vite and `client/vercel.json` are picked up automatically.
2. Add `VITE_API_URL=https://<your-api>.vercel.app`.
3. Deploy, then put the client URL into `CLIENT_ORIGIN` on the API project and redeploy it.

`client/vercel.json` rewrites all paths to `index.html` so deep links like `/trips/123` work.

### Alternative: API on Render

`render.yaml` is a Render Blueprint that runs the API as a long-lived Node server (`npm start`). Render asks for card verification even on its free plan.

## Notes

- Hotel names and prices are sample data for demonstration only.
- Crowd levels are simple rule-based estimates, not live data.
- `bcryptjs` (a pure-JS bcrypt) is used instead of the native `bcrypt` package so installs work on any platform without build tools; hashes are compatible.

