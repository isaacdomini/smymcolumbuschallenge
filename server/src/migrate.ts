import pool from './db/pool.js';

const migrations = [
  // Users table - Initial creation
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    password VARCHAR(255),
    is_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    email_notifications BOOLEAN DEFAULT true
  )`,

  // ADDED: Columns for password reset
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires BIGINT`,

  // ADDED: Admin flag
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false`,

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
    started_at TIMESTAMP,
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

  // push_subscriptions table
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    keys JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // visit_logs table
  `CREATE TABLE IF NOT EXISTS visit_logs (
    id SERIAL PRIMARY KEY,
    ip_address INET,
    user_agent TEXT,
    path TEXT NOT NULL,
    method VARCHAR(10) NOT NULL,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT UNIQUE,
    keys JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // MODIFIED: Add columns for native push tokens
  `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS device_token TEXT`,
  `ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS platform VARCHAR(10)`,
  `ALTER TABLE push_subscriptions ALTER COLUMN endpoint DROP NOT NULL`,
  `ALTER TABLE push_subscriptions ALTER COLUMN keys DROP NOT NULL`,
  `ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS unique_device_token`,
  `ALTER TABLE push_subscriptions ADD CONSTRAINT unique_device_token UNIQUE (device_token)`,


  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_games_challenge_id ON games(challenge_id)`,
  `CREATE INDEX IF NOT EXISTS idx_games_date ON games(date)`,
  `CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON game_submissions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_submissions_game_id ON game_submissions(game_id)`,
  `CREATE INDEX IF NOT EXISTS idx_submissions_challenge_id ON game_submissions(challenge_id)`,
  `CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_visit_logs_created_at ON visit_logs(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_visit_logs_ip_address ON visit_logs(ip_address)`,
  `CREATE INDEX IF NOT EXISTS idx_visit_logs_path ON visit_logs(path)`,

  // Daily Messages table
  `CREATE TABLE IF NOT EXISTS daily_messages (
    id VARCHAR(255) PRIMARY KEY,
    date VARCHAR(10) NOT NULL UNIQUE,
    content JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // Convert daily_messages content to JSONB
  `ALTER TABLE daily_messages ALTER COLUMN content TYPE JSONB USING content::jsonb`,

  // Remove title column
  `ALTER TABLE daily_messages DROP COLUMN IF EXISTS title`,

  // notification_logs table
  `CREATE TABLE IF NOT EXISTS notification_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    recipient TEXT NOT NULL,
    content JSONB NOT NULL,
    status VARCHAR(20) NOT NULL,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(type)`,
  `CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at)`
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
  }
}

if (process.argv[1] && process.argv[1].includes('migrate.js')) {
  runMigrations().then(() => pool.end());
} else {
  runMigrations().then(() => pool.end());
}