
import dotenv from 'dotenv';
dotenv.config();

console.log('Script loaded. Importing pool...');
import pool from '../src/db/pool.js';
console.log('Pool imported.');

async function backfillConnections() {
  console.log('Connecting to DB...');
  const client = await pool.connect();
  console.log('Connected to DB.');
  try {
    console.log('Starting backfill for Connections submissions...');

    // 1. Find all connections submissions that are missing assignedCategories
    const result = await client.query(`
            SELECT gs.id, gs.user_id, gs.game_id, gs.submission_data 
            FROM game_submissions gs
            JOIN games g ON gs.game_id = g.id
            WHERE g.type = 'connections'
              AND (gs.submission_data->>'assignedCategories') IS NULL
        `);

    console.log(`Found ${result.rows.length} submissions to check.`);

    let updatedCount = 0;

    for (const submission of result.rows) {
      const { id, user_id, game_id, submission_data } = submission;

      // 2. Check game_progress for this user and game
      const progressResult = await client.query(`
                SELECT game_state 
                FROM game_progress 
                WHERE user_id = $1 AND game_id = $2
            `, [user_id, game_id]);

      if (progressResult.rows.length > 0) {
        const gameState = progressResult.rows[0].game_state;
        if (gameState && gameState.assignedCategories) {

          console.log(`Updating submission ${id} with categories from progress...`);

          // 3. Update submission_data
          const newSubmissionData = {
            ...submission_data,
            assignedCategories: gameState.assignedCategories
          };

          await client.query(`
                        UPDATE game_submissions
                        SET submission_data = $1
                        WHERE id = $2
                    `, [JSON.stringify(newSubmissionData), id]);

          updatedCount++;
        }
      }
    }

    console.log(`Backfill complete. Updated ${updatedCount} submissions.`);

  } catch (error) {
    console.error('Backfill error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

backfillConnections();
