import pool from '../db/pool.js';
import { resolveGameData } from '../routes/api.js';

export const runDailyGameMaintenance = async (targetDate?: Date) => {
  console.log(`Running daily game maintenance job${targetDate ? ` for ${targetDate.toISOString()}` : ''}...`);
  try {
    // Calculate date in Eastern Time
    const dateToProcess = targetDate || new Date();
    const dateStr = dateToProcess.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    // 1. Check if a game exists for the target date
    // We need to find the active challenge first
    // Note: For future dates, they might fall into a future challenge.
    const challengeResult = await pool.query(
      'SELECT id FROM challenges WHERE start_date <= $1 AND end_date >= $1 LIMIT 1',
      [dateToProcess]
    );

    if (challengeResult.rows.length === 0) {
      console.log(`No active challenge for ${dateStr}, skipping game creation.`);
      return;
    }
    const challengeId = challengeResult.rows[0].id;

    const gameResult = await pool.query(
      'SELECT id, type, data FROM games WHERE challenge_id = $1 AND DATE(date) = $2',
      [challengeId, dateStr]
    );

    let gameId;
    let gameType;
    let gameData;

    if (gameResult.rows.length === 0) {
      console.log(`No game found for ${dateStr}. Creating default Wordle Bank game.`);

      // For Wordle Bank, we don't insert solutions here; 
      // they are fetched from the challenge's word_bank at runtime in resolveGameData.
      const newGameResult = await pool.query(
        `INSERT INTO games (id, challenge_id, date, type, data, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                     RETURNING id, type, data`,
        [`game-${challengeId}-${dateStr}`, challengeId, dateStr, 'wordle_bank', {}]
      );

      gameId = newGameResult.rows[0].id;
      gameType = newGameResult.rows[0].type;
      gameData = newGameResult.rows[0].data;
    } else {
      gameId = gameResult.rows[0].id;
      gameType = gameResult.rows[0].type;
      gameData = gameResult.rows[0].data;
      console.log(`Game already exists for ${dateStr}: ${gameType} (${gameId})`);
    }

    // 2. Pre-assign words for all verified users
    // This ensures every user has their random variant "locked in" before the day starts
    const users = await pool.query('SELECT id FROM users WHERE is_verified = true');
    console.log(`Pre-assigning games for ${users.rows.length} users...`);

    let assignedCount = 0;
    const gameObj = { id: gameId, type: gameType, data: gameData };

    for (const user of users.rows) {
      try {
        // resolveGameData handles the logic of creating/updating game_progress
        // with the assigned variant (if applicable for the game type)
        await resolveGameData(gameObj, user.id);
        assignedCount++;
      } catch (err) {
        console.error(`Failed to assign game for user ${user.id}:`, err);
      }
    }
    console.log(`Daily maintenance complete for ${dateStr}. Assigned ${assignedCount} games.`);

  } catch (error) {
    console.error('Error running daily maintenance job:', error);
    throw error; // Re-throw so caller knows it failed
  }
};
