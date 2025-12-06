
import pg from 'pg';
const { Pool } = pg;

// Configuration matching docker-compose defaults
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'smym_bible_games',
  password: 'postgres',
  port: 5432,
});

const isDryRun = process.argv.includes('--dry-run');

async function cleanupProgress() {
  try {
    console.log('Starting cleanup of redundant game_progress records...');
    if (isDryRun) console.log('DRY RUN MODE: No records will be deleted.');

    // Find records to be deleted
    const findRes = await pool.query(`
      SELECT gp.id, gp.user_id, gp.game_id, gp.updated_at
      FROM game_progress gp
      WHERE EXISTS (
        SELECT 1 
        FROM game_submissions gs 
        WHERE gs.user_id = gp.user_id 
        AND gs.game_id = gp.game_id
      )
    `);
    
    const count = findRes.rowCount;
    console.log(`Found ${count} redundant progress records.`);

    if (count > 0) {
      if (isDryRun) {
        console.log('Records that would be deleted:');
        console.table(findRes.rows);
      } else {
        // Perform deletion
        const deleteRes = await pool.query(`
          DELETE FROM game_progress gp
          WHERE EXISTS (
            SELECT 1 
            FROM game_submissions gs 
            WHERE gs.user_id = gp.user_id 
            AND gs.game_id = gp.game_id
          )
        `);
        console.log(`Successfully deleted ${deleteRes.rowCount} records.`);
      }
    } else {
      console.log('No records to delete.');
    }

  } catch (err) {
    console.error('Cleanup Error:', err);
  } finally {
    await pool.end();
  }
}

cleanupProgress();
