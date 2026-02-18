import pool from './server/src/db/pool';

async function check() {
  try {
    const res = await pool.query("SELECT to_regclass('public.groups')");
    console.log('Groups table exists:', res.rows[0].to_regclass !== null);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

check();
