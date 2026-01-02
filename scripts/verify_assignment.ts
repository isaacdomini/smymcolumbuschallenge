import { pool } from '../server/src/db/pool.ts';
import { resolveGameData } from '../server/src/routes/api.ts';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

console.log('DB Config:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  db: process.env.DB_NAME,
  user: process.env.DB_USER
});

async function runVerification() {
  try {
    console.log('Starting verification...');

    // 1. Create a test user
    const userId = uuidv4();
    await pool.query('INSERT INTO users (id, name, email) VALUES ($1, $2, $3)', [userId, 'Test User', `test-${userId}@example.com`]);
    console.log('Created test user:', userId);

    // 2. Create a test challenge
    const challengeId = 'test-challenge-' + uuidv4();
    await pool.query("INSERT INTO challenges (id, name, start_date, end_date) VALUES ($1, 'Test Challenge', NOW(), NOW() + INTERVAL '1 day')", [challengeId]);

    // 3. Create a Wordle game with multiple solutions
    const gameId = 'test-wordle-' + uuidv4();
    const gameData = {
      solutions: ['APPLE', 'BERRY', 'CHERRY'],
      wordLength: 5
    };
    await pool.query(
      "INSERT INTO games (id, challenge_id, date, type, data) VALUES ($1, $2, NOW(), 'wordle', $3)",
      [gameId, challengeId, JSON.stringify(gameData)]
    );
    console.log('Created test game:', gameId);

    // 4. Fetch game data for user (should assign a solution)
    const gameResult = await pool.query('SELECT * FROM games WHERE id = $1', [gameId]);
    const game = gameResult.rows[0];

    console.log('Resolving game data first time...');
    const resolvedFirst = await resolveGameData(game, userId, false); // false to see solution
    const assignedFirst = resolvedFirst.data.solution;
    console.log('Assigned solution (1st):', assignedFirst);

    if (!['APPLE', 'BERRY', 'CHERRY'].includes(assignedFirst)) {
      throw new Error('Assigned solution is not in the list!');
    }

    // 5. Fetch again (should be same)
    console.log('Resolving game data second time...');
    const resolvedSecond = await resolveGameData(game, userId, false);
    const assignedSecond = resolvedSecond.data.solution;
    console.log('Assigned solution (2nd):', assignedSecond);

    if (assignedFirst !== assignedSecond) {
      throw new Error('Assignment is not persistent!');
    }

    // 6. Create another user
    const user2Id = uuidv4();
    await pool.query('INSERT INTO users (id, name, email) VALUES ($1, $2, $3)', [user2Id, 'Test User 2', `test-${user2Id}@example.com`]);

    // 7. Fetch for user 2 (should be random, might be different)
    console.log('Resolving game data for User 2...');
    const resolvedUser2 = await resolveGameData(game, user2Id, false);
    console.log('Assigned solution (User 2):', resolvedUser2.data.solution);

    console.log('Verification SUCCESS!');

  } catch (e) {
    console.error('Verification FAILED:', e);
  } finally {
    process.exit(0);
  }
}

runVerification();
