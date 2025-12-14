import pool from '../db/pool.js';

const isDryRun = process.argv.includes('--dry-run');

async function backfillConnectionsCategories() {
  console.log(`Starting Connections categories backfill... ${isDryRun ? '(DRY RUN)' : ''}`);

  try {
    // 1. Get all Connections submissions missing assignedCategories in submission_data
    // We check for 'connections' game type and ensure submission_data doesn't already have assignedCategories
    const query = `
      SELECT gs.id, gs.user_id, gs.game_id, gs.submission_data
      FROM game_submissions gs
      JOIN games g ON gs.game_id = g.id
      WHERE g.type = 'connections'
      AND (gs.submission_data::text NOT LIKE '%"assignedCategories"%')
    `;

    const result = await pool.query(query);
    console.log(`Found ${result.rows.length} submissions to check.`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const row of result.rows) {
      const { id, user_id, game_id, submission_data } = row;
      let assignedCategories: string[] | undefined;

      // 2. Look up from Game Progress
      const progressQuery = `SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2`;
      const progressRes = await pool.query(progressQuery, [user_id, game_id]);

      if (progressRes.rows.length > 0) {
        const state = progressRes.rows[0].game_state;
        if (state.assignedCategories && Array.isArray(state.assignedCategories)) {
          assignedCategories = state.assignedCategories;
        }
      }

      if (assignedCategories) {
        // Update the record
        const newSubmissionData = {
          ...submission_data,
          assignedCategories: assignedCategories
        };

        if (!isDryRun) {
          await pool.query(
            `UPDATE game_submissions SET submission_data = $1 WHERE id = $2`,
            [newSubmissionData, id]
          );
        }
        updatedCount++;
        if (updatedCount % 10 === 0) process.stdout.write('.');
      } else {
        skippedCount++;
        // console.log(`[Skip] Could not determine assignedCategories for submission ${id} (Game: ${game_id}, User: ${user_id})`);
      }
    }

    console.log('\n');
    console.log(`Backfill complete.`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped: ${skippedCount} (No matching game_progress found)`);

  } catch (error) {
    console.error('Error running backfill:', error);
  } finally {
    await pool.end();
  }
}

backfillConnectionsCategories();
