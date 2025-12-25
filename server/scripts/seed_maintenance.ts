import pool from '../src/db/pool';

const seed = async () => {
  try {
    console.log('Seeding maintenance_mode flag...');
    await pool.query(
      `INSERT INTO feature_flags (key, enabled, description, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (key) DO NOTHING`,
      ['maintenance_mode', false, 'Enable maintenance mode to block non-admin users']
    );
    console.log('Seeding complete.');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await pool.end();
  }
};

seed();
