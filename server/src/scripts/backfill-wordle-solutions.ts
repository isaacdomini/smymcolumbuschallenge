import pool from '../db/pool.js';

const isDryRun = process.argv.includes('--dry-run');

async function backfillWordleSolutions() {
  console.log(`Starting Wordle solution backfill... ${isDryRun ? '(DRY RUN)' : ''}`);

  try {
    // 1. Get all Wordle submissions missing a solution in submission_data
    const query = `
      SELECT gs.id, gs.user_id, gs.game_id, gs.submission_data, g.data as game_data, g.type as game_type
      FROM game_submissions gs
      JOIN games g ON gs.game_id = g.id
      WHERE (g.type = 'wordle' OR g.type = 'wordle_advanced' OR g.type = 'wordle_bank')
      AND (gs.submission_data::text NOT LIKE '%"solution"%')
    `;

    const result = await pool.query(query);
    console.log(`Found ${result.rows.length} submissions to check.`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const row of result.rows) {
      const { id, user_id, game_id, submission_data, game_data, game_type } = row;
      let solution = '';

      // Strategy 1: Infer from winning guesses
      if (submission_data.guesses && submission_data.guessResults) {
        const guesses = submission_data.guesses;
        const results = submission_data.guessResults;

        for (let i = 0; i < results.length; i++) {
          const resultRow = results[i];
          if (Array.isArray(resultRow) && resultRow.every((r: string) => r === 'correct')) {
            if (guesses[i]) {
              solution = guesses[i];
              // console.log(`[Infer] Found solution "${solution}" for submission ${id} from guesses.`);
              break;
            }
          }
        }
      }

      // Strategy 2: Look up from Game Data (Standard Wordle)
      if (!solution && game_type === 'wordle') {
        if (game_data.solution) {
          solution = game_data.solution;
          // console.log(`[Lookup] Found solution "${solution}" for submission ${id} from game data.`);
        }
      }

      // Strategy 3: Look up from Game Progress (Advanced/Bank)
      if (!solution && (game_type === 'wordle_advanced' || game_type === 'wordle_bank')) {
        // We need to check the user's progress for this game to match the assigned word
        const progressQuery = `SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2`;
        const progressRes = await pool.query(progressQuery, [user_id, game_id]);

        if (progressRes.rows.length > 0) {
          const state = progressRes.rows[0].game_state;
          if (state.solution) {
            solution = state.solution;
          } else if (state.assignedSolution && state.assignedSolution.answer) {
            solution = state.assignedSolution.answer;
          } else if (state.answer) {
            solution = state.answer;
          }
        }
      }

      if (solution) {
        // Update the record
        const newSubmissionData = {
          ...submission_data,
          solution: solution
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
        // console.log(`[Skip] Could not determine solution for submission ${id} (Game: ${game_id})`);
      }
    }

    console.log('\n');
    console.log(`Backfill complete.`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped: ${skippedCount} (Could not determine solution)`);

  } catch (error) {
    console.error('Error running backfill:', error);
  } finally {
    await pool.end();
  }
}

backfillWordleSolutions();
