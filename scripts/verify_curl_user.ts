
import { Pool } from 'pg';
const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@10.0.0.3:5432/smym_bible_games',
});

async function run() {
  await pool.query("UPDATE users SET is_verified = true WHERE email = 'curl@test.com'");
  console.log('User verified');
  await pool.end();
}

run();
