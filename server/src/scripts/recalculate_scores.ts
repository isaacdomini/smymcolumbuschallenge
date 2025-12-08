import pool from '../db/pool.js';
import { calculateScore, resolveGameData } from '../routes/api.js';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed: any = { dryRun: false };

  args.forEach(arg => {
    if (arg === '--dry-run') {
      parsed.dryRun = true;
    } else if (arg.startsWith('--gameId=')) {
      parsed.gameId = arg.split('=')[1];
    } else if (arg.startsWith('--userId=')) {
      parsed.userId = arg.split('=')[1];
    }
  });

  return parsed;
};

const recalculateScores = async () => {
  const { gameId, userId, dryRun } = parseArgs();

  // If both absent, warn user
  if (!gameId && !userId) {
    console.error('Error: Please provide at least one of --gameId or --userId');
    process.exit(1);
  }

  console.log(`Starting recalculation... Mode: ${dryRun ? 'DRY RUN' : 'LIVE update'}`);
  console.log(`Filters - Game: ${gameId || 'ALL'}, User: ${userId || 'ALL'}`);

  try {
    // 1. Fetch Submissions
    let query = `
      SELECT gs.*, g.date as game_date, g.type as game_type, g.data as game_data, g.challenge_id
      FROM game_submissions gs
      JOIN games g ON gs.game_id = g.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (gameId) {
      query += ` AND gs.game_id = $${paramIndex++}`;
      params.push(gameId);
    }
    if (userId) {
      query += ` AND gs.user_id = $${paramIndex++}`;
      params.push(userId);
    }

    const { rows: submissions } = await pool.query(query, params);
    console.log(`Found ${submissions.length} submissions to process.`);

    for (const sub of submissions) {
      // Reconstruct game object for resolveGameData
      const gameObj = {
        id: sub.game_id,
        challenge_id: sub.challenge_id,
        date: new Date(sub.game_date),
        type: sub.game_type,
        data: sub.game_data
      };

      // 2. Resolve Game Data (to assign solution)
      // Note: resolveGameData logic handles fetching assigned solution from DB or re-assiging.
      // Since we are processing a submission that exists, it should find the assigned solution.
      const resolvedGame = await resolveGameData(gameObj, sub.user_id, false);

      // 3. Recalculate Mistakes (Optional? The user request said "recalculate scores")
      // Score depends on mistakes. If mistakes were WRONG in DB (like the crossword issue), we need to fix mistakes too.
      // But re-calculating mistakes requires duplicating the validation logic from the submit endpoint.
      // Let's assume mistakes in DB *might* be wrong if the puzzle was wrong.
      // But for some games (Wordle), mistakes is number of guesses.
      // Ideally we re-validate everything.
      // For now, let's allow recalculating Score based on stored mistakes/time, OR re-validate completely.
      // Given the previous turn was about fixing "incorrect mistakes" in Crossword, I should probably re-calculate mistakes for Crossword at least.
      // But re-writing validation for all game types in a script is duplicate code.
      // However, calculating score requires 'mistakes' count.
      // If I just call calculateScore(resolvedGame, sub.submission_data, sub.time_taken, sub.mistakes), it uses the OLD mistakes.
      // If the old mistakes were wrong, the score will still be wrong.
      // The user likely wants to FIX the score, which implies fixing the inputs to the score.

      // Let's import the validation logic? It's embedded in the huge /submit endpoint.
      // For this script, I will focus on calling `calculateScore` but I will implement a re-validation helper 
      // strictly for Crossword since that was the specific issue, and maybe simple ones.
      // Or just trust DB mistakes for now unless it's crossword?

      let calculatedMistakes = sub.mistakes;

      if (sub.game_type === 'crossword' && sub.submission_data) {
        // Re-validate Crossword
        const { rows, cols, acrossClues, downClues } = resolvedGame.data;
        const userGrid = sub.submission_data.grid;
        if (userGrid) {
          const solutionGrid: any[][] = Array(rows).fill(null).map(() => Array(cols).fill(null));
          const allClues = [...acrossClues, ...downClues];
          allClues.forEach((clue: any) => {
            if (!clue.answer) return;
            for (let i = 0; i < clue.answer.length; i++) {
              const r = clue.direction === 'across' ? clue.row : clue.row + i;
              const c = clue.direction === 'across' ? clue.col + i : clue.col;
              if (solutionGrid[r] && c < cols) {
                solutionGrid[r][c] = clue.answer[i];
              }
            }
          });

          let mistakes = 0;
          let correctCells = 0;
          let totalFillable = 0;

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (solutionGrid[r][c] !== null) {
                totalFillable++;
                if (userGrid[r] && userGrid[r][c] === solutionGrid[r][c]) {
                  correctCells++;
                } else if (userGrid[r] && userGrid[r][c]) {
                  mistakes++;
                }
              }
            }
          }
          // Update local vars for score calc
          calculatedMistakes = mistakes;
          sub.submission_data.correctCells = correctCells;
          sub.submission_data.totalFillableCells = totalFillable;
        }
      }

      // 4. Calculate Score
      const newScore = calculateScore(resolvedGame, sub.submission_data, sub.time_taken, calculatedMistakes);

      if (newScore !== sub.score) {
        console.log(`[CHANGE] User ${sub.user_id} Game ${sub.game_id}: Score ${sub.score} -> ${newScore} (Mistakes: ${sub.mistakes} -> ${calculatedMistakes})`);

        if (!dryRun) {
          // Update DB
          // We also update mistakes if changed, and submission_data (if we updated correctCells etc)
          await pool.query(
            `UPDATE game_submissions 
                 SET score = $1, mistakes = $2, submission_data = $3 
                 WHERE id = $4`,
            [newScore, calculatedMistakes, JSON.stringify(sub.submission_data), sub.id]
          );
        }
      } else {
        // console.log(`[OK] User ${sub.user_id} Game ${sub.game_id}: Score unchanged (${sub.score})`);
      }
    }

    console.log('Recalculation complete.');
  } catch (error) {
    console.error('Error recalculating scores:', error);
  } finally {
    await pool.end();
  }
};

recalculateScores();
