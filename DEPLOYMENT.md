# Run and Deploy SMYM Columbus Bible Games

This application can be run in two modes:
1. **Development mode** - Uses mock data (no database required)
2. **Production mode** - Uses PostgreSQL database via Docker Compose

## Development Mode

### Prerequisites
- Node.js (v18 or higher)

### Setup
1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open http://localhost:5173 in your browser

In development mode, the app uses mock data and doesn't require a database.

## Production Mode with Docker Compose

### Prerequisites
- Docker
- Docker Compose

### Setup

1. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

2. Update the `.env` file with your configuration (or use defaults)

3. Build and run with Docker Compose:
   ```bash
   docker-compose up --build
   ```

4. The application will:
   - Start PostgreSQL database
   - Run migrations to create tables
   - Seed the database with initial data
   - Start the application server

5. Open http://localhost:3000 in your browser

### Docker Compose Services

- **postgres**: PostgreSQL 15 database
- **app**: Node.js application server serving both API and frontend

### Environment Variables

See `.env.example` for all available environment variables:

- `NODE_ENV`: Set to `production` to use the database
- `PORT`: Server port (default: 3000)
- `DB_HOST`: Database host
- `DB_PORT`: Database port
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password

## Database Management

### Run Migrations Manually
```bash
npm run migrate
```

### Seed Database Manually
```bash
npm run seed
```

### Run Server Only
```bash
npm run server
```

## Development Server (Backend)

To run the backend server in development mode with hot reload:
```bash
npm run dev:server
```

## Architecture

- **Frontend**: React + Vite + TypeScript
- **Backend**: Express + Node.js + TypeScript
- **Database**: PostgreSQL
- **API**: RESTful API at `/api/*`

### Database Schema

- `users`: User accounts
- `challenges`: Game challenges with start/end dates
- `games`: Daily games (Wordle, Connections, Crossword)
- `game_submissions`: User game submissions and scores

## Building for Production

```bash
npm run build
```

This will:
1. Build the frontend React app
2. Compile the backend TypeScript to JavaScript
