import pool from './db/pool.js';

const migrations = [
  // Users table
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // Challenges table
  `CREATE TABLE IF NOT EXISTS challenges (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // Games table
  `CREATE TABLE IF NOT EXISTS games (
    id VARCHAR(255) PRIMARY KEY,
    challenge_id VARCHAR(255) NOT NULL REFERENCES challenges(id),
    date TIMESTAMP NOT NULL,
    type VARCHAR(50) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // Game submissions table
  `CREATE TABLE IF NOT EXISTS game_submissions (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    game_id VARCHAR(255) NOT NULL REFERENCES games(id),
    challenge_id VARCHAR(255) NOT NULL REFERENCES challenges(id),
    completed_at TIMESTAMP NOT NULL,
    time_taken INTEGER NOT NULL,
    mistakes INTEGER NOT NULL,
    score INTEGER NOT NULL,
    submission_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Game progress table
  `CREATE TABLE IF NOT EXISTS game_progress (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    game_id VARCHAR(255) NOT NULL REFERENCES games(id),
    game_state JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, game_id)
  )`,
  
  // Indexes for better performance
  `CREATE INDEX IF NOT EXISTS idx_games_challenge_id ON games(challenge_id)`,
  `CREATE INDEX IF NOT EXISTS idx_games_date ON games(date)`,
  `CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON game_submissions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_submissions_game_id ON game_submissions(game_id)`,
  `CREATE INDEX IF NOT EXISTS idx_submissions_challenge_id ON game_submissions(challenge_id)`,
];

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    for (const migration of migrations) {
      await client.query(migration);
    }
    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
