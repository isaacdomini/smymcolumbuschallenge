import pool from './db/pool.js';

async function seedDatabase() {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');

    // Seed users
    const users = [
      { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
      { id: 'user-2', name: 'Jane Smith', email: 'jane@example.com' },
      { id: 'user-3', name: 'Peter Jones', email: 'peter@example.com' },
    ];

    for (const user of users) {
      await client.query(
        'INSERT INTO users (id, name, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [user.id, user.name, user.email]
      );
    }
    console.log('Users seeded');

    // Seed challenge
    const challengeId = 'challenge-1';
    const challengeName = 'Lenten Challenge 2025';
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
        game.data = { solution: i === 0 ? 'GRACE' : i === 3 ? 'ANGEL' : 'FAITH' };
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
        game.id = `game-cross-${dateStr}`;
        game.type = 'crossword';
        game.data = {
          grid: [
            ['A', 'D', 'A', 'M', null],
            ['B', '#', 'R', '#', 'O'],
            ['E', 'L', 'I', 'J', 'A', 'H'],
            ['L', '#', 'A', '#', 'H']
          ],
          clues: {
            across: { 1: "First man", 6: "Prophet fed by ravens" },
            down: { 2: "Garden of Eden fruit", 3: "Slayer of Goliath" },
          },
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
        id: 'sub-4',
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

seedDatabase();
