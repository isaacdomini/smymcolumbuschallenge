import pool from './db/pool.js';
import bcrypt from 'bcrypt';

async function seedDatabase() {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');

    // Hash a password for seed users
    // const salt = await bcrypt.genSalt(10);
    // const hashedPassword = await bcrypt.hash('password123', salt);

    // // Seed users
    // const users = [
    //   { id: 'user-1', name: 'John Doe', email: 'john@example.com', password: hashedPassword, is_verified: true },
    //   { id: 'user-2', name: 'Jane Smith', email: 'jane@example.com', password: hashedPassword, is_verified: true },
    //   { id: 'user-3', name: 'Peter Jones', email: 'peter@example.com', password: hashedPassword, is_verified: true },
    // ];

    // for (const user of users) {
    //   await client.query(
    //     'INSERT INTO users (id, name, email, password, is_verified) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO UPDATE SET name = $2, password = $4, is_verified = $5',
    //     [user.id, user.name, user.email, user.password, user.is_verified]
    //   );
    // }
    // console.log('Users seeded');
// Seed challenge
    const challengeId = 'challenge-advent-2025';
    const challengeName = 'November 2025 Christian Challenge';
    // Set dates to cover the requested range (Nov 8 - Nov 15, 2025)
    const startDate = new Date('2025-11-08T00:00:00Z'); // Saturday
    const endDate = new Date('2025-11-15T23:59:59Z');   // Saturday following

    await client.query(
      'INSERT INTO challenges (id, name, start_date, end_date) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date',
      [challengeId, challengeName, startDate, endDate]
    );
    console.log('Challenge seeded');

    // Define specific games for the requested week
    const gamesToSeed = [
        // Nov 8, 2025 - Saturday - Connections (Hard)
        {
            date: '2025-11-08',
            type: 'connections',
            data: {
                words: [
                    'ELOHIM', 'YAHWEH', 'ADONAI', 'SHADDAI',
                    'TAMAR', 'RAHAB', 'RUTH', 'BATHSHEBA',
                    'FROGS', 'GNATS', 'HAIL', 'BOILS',
                    'WISDOM', 'KNOWLEDGE', 'FAITH', 'HEALING'
                ],
                categories: [
                    { name: 'HEBREW NAMES OF GOD', words: ['ELOHIM', 'YAHWEH', 'ADONAI', 'SHADDAI'] },
                    { name: 'WOMEN IN MATTHEW\'S GENEALOGY', words: ['TAMAR', 'RAHAB', 'RUTH', 'BATHSHEBA'] },
                    { name: 'PLAGUES OF EGYPT', words: ['FROGS', 'GNATS', 'HAIL', 'BOILS'] },
                    { name: 'SPIRITUAL GIFTS (1 COR 12)', words: ['WISDOM', 'KNOWLEDGE', 'FAITH', 'HEALING'] },
                ]
            }
        },
        // Nov 9, 2025 - Sunday - Christian Crossword
        {
             date: '2025-11-09',
             type: 'crossword',
             data: {
                 gridSize: 5,
                 // Grid Layout:
                 // H O P E .
                 // O P E N .
                 // S E N T .
                 // T E N T .
                 // . . . . .
                 acrossClues: [
                     { number: 1, clue: 'And now these three remain: faith, ___, and love', answer: 'HOPE', row: 0, col: 0, direction: 'across' },
                     { number: 5, clue: '"Knock and the door will be ___ to you"', answer: 'OPEN', row: 1, col: 0, direction: 'across' },
                     { number: 6, clue: '"Here I am, ___ me!" (Isaiah 6:8)', answer: 'SENT', row: 2, col: 0, direction: 'across' },
                     { number: 7, clue: 'Dwelling for Abraham or Paul\'s trade', answer: 'TENT', row: 3, col: 0, direction: 'across' }
                 ],
                 downClues: [
                     { number: 1, clue: 'Heavenly army', answer: 'HOST', row: 0, col: 0, direction: 'down' },
                     { number: 2, clue: 'Not closed (reused word)', answer: 'OPEN', row: 0, col: 1, direction: 'down' },
                     { number: 3, clue: 'Fifty days after Passover (Acts 2)', answer: 'PENT', row: 0, col: 2, direction: 'down' },
                     { number: 4, clue: 'Garden of first sin (var. sp.)', answer: 'ENT', row: 0, col: 3, direction: 'down' } 
                 ]
             }
        },
        // Nov 10, 2025 - Monday - Wordle
        { date: '2025-11-10', type: 'wordle', data: { solution: 'FAITH' } },
        // Nov 11, 2025 - Tuesday - Wordle
        { date: '2025-11-11', type: 'wordle', data: { solution: 'GRACE' } },
        // Nov 12, 2025 - Wednesday - Wordle
        { date: '2025-11-12', type: 'wordle', data: { solution: 'MERCY' } },
        // Nov 13, 2025 - Thursday - Wordle
        { date: '2025-11-13', type: 'wordle', data: { solution: 'GLORY' } },
        // Nov 14, 2025 - Friday - Wordle
        { date: '2025-11-14', type: 'wordle', data: { solution: 'PEACE' } },
        // Nov 15, 2025 - Saturday - Connections (Hard)
        {
            date: '2025-11-15',
            type: 'connections',
            data: {
                words: [
                    'SAUL', 'DAVID', 'SOLOMON', 'REHOBOAM',
                    'EGYPT', 'ASSYRIA', 'BABYLON', 'PERSIA',
                    'MATTHEW', 'MARK', 'LUKE', 'JOHN',
                    'JOSHUA', 'JUDGES', 'RUTH', 'ESTHER'
                ],
                categories: [
                    { name: 'FIRST FOUR KINGS OF JUDAH/ISRAEL', words: ['SAUL', 'DAVID', 'SOLOMON', 'REHOBOAM'] },
                    { name: 'NATIONS THAT OPPRESSED ISRAEL', words: ['EGYPT', 'ASSYRIA', 'BABYLON', 'PERSIA'] },
                    { name: 'THE FOUR GOSPELS', words: ['MATTHEW', 'MARK', 'LUKE', 'JOHN'] },
                    { name: 'OLD TESTAMENT HISTORICAL BOOKS', words: ['JOSHUA', 'JUDGES', 'RUTH', 'ESTHER'] },
                ]
            }
        }
    ];

    // Insert the specific games
    for (const gameData of gamesToSeed) {
        const gameId = `game-${gameData.type}-${gameData.date}`;
        // Ensure date is a Date object for the query if needed, or keep as string if DB handles it.
        // Assuming DB column is DATE or TIMESTAMPTZ, passing ISO string usually works in pg.
        await client.query(
            'INSERT INTO games (id, challenge_id, date, type, data) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, type = EXCLUDED.type',
            [gameId, challengeId, gameData.date, gameData.type, JSON.stringify(gameData.data)]
        );
        console.log(`Seeded ${gameData.type} for ${gameData.date}`);
    }
    // Seed submissions
    // const submissions = [
    //   {
    //     id: 'sub-1',
    //     userId: 'user-1',
    //     gameId: games[0].id,
    //     challengeId,
    //     completedAt: new Date(),
    //     timeTaken: 60,
    //     mistakes: 2,
    //     score: 76,
    //     submissionData: { guesses: ['WRONG', 'GUESS', 'GRACE'] }
    //   },
    //   {
    //     id: 'sub-2',
    //     userId: 'user-2',
    //     gameId: games[0].id,
    //     challengeId,
    //     completedAt: new Date(),
    //     timeTaken: 45,
    //     mistakes: 1,
    //     score: 87,
    //     submissionData: { guesses: ['OTHER', 'GRACE'] }
    //   },
    //   {
    //     id: 'sub-3',
    //     userId: 'user-2',
    //     gameId: games[1].id,
    //     challengeId,
    //     completedAt: new Date(),
    //     timeTaken: 90,
    //     mistakes: 0,
    //     score: 94
    //   },
    // ];

    // for (const sub of submissions) {
    //   await client.query(
    //     'INSERT INTO game_submissions (id, user_id, game_id, challenge_id, completed_at, time_taken, mistakes, score, submission_data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING',
    //     [sub.id, sub.userId, sub.gameId, sub.challengeId, sub.completedAt, sub.timeTaken, sub.mistakes, sub.score, JSON.stringify(sub.submissionData)]
    //   );
    // }
    // console.log('Submissions seeded');

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