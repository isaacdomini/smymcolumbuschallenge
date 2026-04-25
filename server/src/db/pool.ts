import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'smym_bible_games',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,                  // enough headroom for concurrent push logging
  idleTimeoutMillis: 30000, // release idle connections after 30s
  connectionTimeoutMillis: 5000, // fail fast if pool is exhausted
});

export default pool;
