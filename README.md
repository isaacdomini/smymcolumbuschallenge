# SMYM Columbus Bible Games

A collection of Christian-themed daily puzzle games for the SMYM Columbus community. This application includes games like Wordle, Connections, Crossword, Verse Scramble, and more, integrated with leaderboards and user profiles.

## Technologies

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: PostgreSQL
- **Mobile**: Capacitor (iOS & Android)
- **Notifications**: Web Push, APNs (iOS), Firebase (Android)

## Prerequisites

- Node.js (v18+)
- Docker & Docker Compose (for production/database)
- PostgreSQL (if running locally without Docker)

## Configuration

The application uses environment variables for configuration. 

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your settings. See `.env.example` for details on required variables.

## Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Database
You can use the provided Docker Compose file to start just the database:
```bash
docker-compose up -d postgres
```

### 3. Run Migrations & Seed Data
```bash
npm run migrate
npm run seed
```

### 4. Start Development Servers
Run frontend and backend in development mode:
```bash
npm run dev
npm run dev:server
```
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

## Production Deployment

### Docker Compose
To run the entire stack (App + Database) using Docker:

```bash
docker-compose up --build -d
```
The application will be available at http://localhost:6144 (or whichever port you configured).

### Manual Build
To build for production manually:

```bash
npm run build
npm run server
```

## Mobile Development

The project is configured with Capacitor for mobile deployment.

```bash
# Sync web assets to native projects
npx cap sync

# Open Android Studio
npx cap open android

# Open Xcode
npx cap open ios
```

## Admin & Maintenance

- **Maintenance Scripts**: Located in `server/src/scripts/` (e.g., `run-maintenance.js` for daily game generation).
- **Admin Dashboard**: Accessible in the app for users with `is_admin = true`.

## Feature Flags

This app supports feature flags for toggling functionality. See `server/src/utils/featureFlags.ts` and the `feature_flags` table.
