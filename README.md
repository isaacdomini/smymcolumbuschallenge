<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This application supports both development and production deployment modes.

View your app in AI Studio: https://ai.studio/apps/drive/1DblYDWkItD9C37ipo495nyfUbv3Gl1Ug

## Development Mode (Local with Mock Data)

**Prerequisites:** Node.js (v18 or higher)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set the `GEMINI_API_KEY` in `.env.local` to your Gemini API key (optional)
3. Run the app:
   ```bash
   npm run dev
   ```
4. Open http://localhost:5173 in your browser

In development mode, the app uses mock data and doesn't require a database.

## Production Mode (Docker Compose with PostgreSQL)

**Prerequisites:** Docker and Docker Compose

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

## Manual Server Setup (Without Docker)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up PostgreSQL database and update environment variables

3. Run migrations:
   ```bash
   npm run migrate
   ```

4. Seed the database:
   ```bash
   npm run seed
   ```

5. Build the application:
   ```bash
   npm run build
   ```

6. Start the server:
   ```bash
   npm run server
   ```

For more details, see [DEPLOYMENT.md](DEPLOYMENT.md).
