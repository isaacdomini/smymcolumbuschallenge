import pool from './db/pool.js';
import bcrypt from 'bcrypt';

async function seedDatabase() {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');

    // Hash a password for seed users
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    // Seed users
    const users = [
      { id: 'user-1', name: 'John Doe', email: 'john@example.com', password: hashedPassword, is_verified: true },
      { id: 'user-2', name: 'Jane Smith', email: 'jane@example.com', password: hashedPassword, is_verified: true },
      { id: 'user-3', name: 'Peter Jones', email: 'peter@example.com', password: hashedPassword, is_verified: true },
    ];

    for (const user of users) {
      await client.query(
        'INSERT INTO users (id, name, email, password, is_verified) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO UPDATE SET name = $2, password = $4, is_verified = $5',
        [user.id, user.name, user.email, user.password, user.is_verified]
      );
    }
    console.log('Users seeded');

    // Seed challenge
    const challengeId = 'challenge-1';
    const challengeName = 'Advent Challenge 2025';
    const startDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2); // 2 days ago
    const endDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 38); // 38 days from now

    await client.query(
      'INSERT INTO challenges (id, name, start_date, end_date) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
      [challengeId, challengeName, startDate, endDate]
    );
    console.log('Challenge seeded');

    // Seed games
    const games = [];
    for (let i = 0; i < 40; i++) {
      const gameDate = new Date(startDate);
      gameDate.setDate(startDate.getDate() + i);
      const dateStr = gameDate.toISOString().split('T')[0];

      const gameTypeIndex = i % 3;
      let game: any = {
        id: '',
        challengeId,
        date: gameDate,
        type: '',
        data: {}
      };

      if (gameTypeIndex === 0) {
        game.id = `game-wordle-${dateStr}`;
        game.type = 'wordle';
        // Example of 5 and 6 letter words
        game.data = { solution: i === 0 ? 'GRACE' : i === 3 ? 'ANGELS' : 'FAITH' }; 
      } else if (gameTypeIndex === 1) {
        game.id = `game-conn-${dateStr}`;
        game.type = 'connections';
        game.data = {
          words: [
            'PETER', 'ANDREW', 'JAMES', 'JOHN',
            'GENESIS', 'EXODUS', 'LEVITICUS', 'NUMBERS',
            'BREAD', 'WINE', 'FISH', 'LAMB',
            'CROSS', 'THORNS', 'NAILS', 'TOMB'
          ],
          categories: [
            { name: 'FIRST FOUR APOSTLES', words: ['PETER', 'ANDREW', 'JAMES', 'JOHN'] },
            { name: 'BOOKS OF THE PENTATEUCH', words: ['GENESIS', 'EXODUS', 'LEVITICUS', 'NUMBERS'] },
            { name: 'BIBLICAL FOODS', words: ['BREAD', 'WINE', 'FISH', 'LAMB'] },
            { name: 'SYMBOLS OF THE PASSION', words: ['CROSS', 'THORNS', 'NAILS', 'TOMB'] },
          ],
        };
      } else {
        // FIX: Updated crossword data structure
        game.id = `game-cross-${dateStr}`;
        game.type = 'crossword';
        game.data = {
          gridSize: 5,
          acrossClues: [
            { number: 1, clue: 'On the ___ (using Tinder or Bumble)', answer: 'APPS', row: 0, col: 0, direction: 'across' },
            { number: 5, clue: 'Color of the second-hardest Connections category', answer: 'BLUE', row: 1, col: 0, direction: 'across' },
            { number: 6, clue: 'Prepare, as a Thanksgiving turkey', answer: 'CARVE', row: 2, col: 0, direction: 'across' },
            { number: 8, clue: 'Have to have', answer: 'NEED', row: 3, col: 1, direction: 'across' },
            { number: 9, clue: 'Camper\'s construction', answer: 'TENT', row: 4, col: 1, direction: 'across' },
          ],
          downClues: [
            { number: 1, clue: 'Kimmel\'s channel', answer: 'ABC', row: 0, col: 0, direction: 'down' },
            { number: 2, clue: 'Audience member who\'s in on the magic trick', answer: 'PLANT', row: 0, col: 1, direction: 'down' },
            { number: 3, clue: 'Many a baby food', answer: 'PUREE', row: 0, col: 2, direction: 'down' },
            { number: 4, clue: 'Typical number of objects that humans can hold in working memory, hence phone numbers', answer: 'SEVEN', row: 0, col: 3, direction: 'down' },
            { number: 7, clue: 'Summer hrs. in N.Y.C.', answer: 'EDT', row: 2, col: 4, direction: 'down' },
          ],
        };
      }
      games.push(game);

      await client.query(
        'INSERT INTO games (id, challenge_id, date, type, data) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        [game.id, game.challengeId, game.date, game.type, JSON.stringify(game.data)]
      );
    }
    console.log('Games seeded');

    // Seed submissions
    const submissions = [
      {
        id: 'sub-1',
        userId: 'user-1',
        gameId: games[0].id,
        challengeId,
        completedAt: new Date(),
        timeTaken: 60,
        mistakes: 2,
        score: 76,
        submissionData: { guesses: ['WRONG', 'GUESS', 'GRACE'] }
      },
      {
        id: 'sub-2',
        userId: 'user-2',
        gameId: games[0].id,
        challengeId,
        completedAt: new Date(),
        timeTaken: 45,
        mistakes: 1,
        score: 87,
        submissionData: { guesses: ['OTHER', 'GRACE'] }
      },
      {
        id: 'sub-3',
        userId: 'user-2',
        gameId: games[1].id,
        challengeId,
        completedAt: new Date(),
        timeTaken: 90,
        mistakes: 0,
        score: 94
      },
    ];

    for (const sub of submissions) {
      await client.query(
        'INSERT INTO game_submissions (id, user_id, game_id, challenge_id, completed_at, time_taken, mistakes, score, submission_data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING',
        [sub.id, sub.userId, sub.gameId, sub.challengeId, sub.completedAt, sub.timeTaken, sub.mistakes, sub.score, JSON.stringify(sub.submissionData)]
      );
    }
    console.log('Submissions seeded');

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Seed error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Check if this script is run directly
if (process.argv[1] && process.argv[1].includes('seed.js')) {
  seedDatabase();
} else {
  // If imported, just export the function
  // This seems to be the pattern from package.json
  seedDatabase();
}