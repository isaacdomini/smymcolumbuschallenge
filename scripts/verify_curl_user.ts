
import * as dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';
const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
});

async function run() {
  await pool.query("UPDATE users SET is_verified = true WHERE email = 'curl@test.com'");
  console.log('User verified');
  await pool.end();
}

run();
