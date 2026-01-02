import pool from './db/pool.js';
import bcrypt from 'bcrypt';

async function seedDatabase() {
    const client = await pool.connect();
    try {
        console.log('Seeding database...');

        // Seed Admin User
        const adminEmail = 'admin@smym.org';
        const salt = await bcrypt.genSalt(10);
        const hashedAdminPassword = await bcrypt.hash('admin123', salt);

        await client.query(
            `INSERT INTO users (id, name, email, password, is_verified, is_admin) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         ON CONFLICT (email) DO UPDATE SET is_admin = true, is_verified = true`,
            ['user-admin', 'SMYM Admin', adminEmail, hashedAdminPassword, true, true]
        );
        console.log('Admin user seeded (admin@smym.org / admin123)');

        // Seed Feature Flags
        await client.query(
            `INSERT INTO feature_flags (key, enabled, description, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description`,
            ['christmas_flair', false, 'Enable Christmas decorative effects (snow, themes)']
        );
        console.log('Feature flags seeded');

        // Seed Default Challenge (Fallback)
        await client.query(
            'INSERT INTO challenges (id, name, start_date, end_date) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date',
            ['challenge-default', 'General Collection', new Date('2024-01-01T00:00:00Z'), new Date('2030-12-31T23:59:59Z')]
        );
        console.log('Default Challenge seeded');

        // Seed specific challenge
        const challengeId = 'challenge-advent-2025';
        const challengeName = 'November 2025 Christian Challenge';
        // Set dates to cover the requested range (Nov 8 - Nov 15, 2025)
        // Note: Ensuring this starts AFTER default challenge so it takes precedence in "latest start date" sort
        const startDate = new Date('2025-11-08T00:00:00-05:00'); // Saturday
        const endDate = new Date('2025-11-15T23:59:59-05:00');   // Saturday following
        await client.query(
            'INSERT INTO challenges (id, name, start_date, end_date) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date',
            [challengeId, challengeName, startDate, endDate]
        );
        console.log('Advent Challenge seeded');

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
                data: { cols: 4, rows: 7, downClues: [{ col: 0, row: 0, clue: "It is patient, it is kind.", answer: "LOVE", number: 1, direction: "down" }, { col: 2, row: 2, clue: "Apostle who denied Jesus three times.", answer: "PETER", number: 2, direction: "down" }], acrossClues: [{ col: 0, row: 0, clue: "Ash-Wednesday to Easter", answer: "LENT", number: 1, direction: "across" }, { col: 0, row: 3, clue: "Garden", answer: "EDEN", number: 3, direction: "across" }, { col: 0, row: 6, clue: "Mother of Jesus", answer: "MARY", number: 4, direction: "across" }] }
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
            },
            // Nov 16, 2025 - Sunday - Match The Word
            {
                date: '2025-11-16',
                type: 'match_the_word',
                data: {
                    pairs: [
                        { word: 'David', match: 'Shepherd King' },
                        { word: 'Moses', match: 'Lawgiver' },
                        { word: 'Abraham', match: 'Father of Nations' },
                        { word: 'Paul', match: 'Apostle to the Gentiles' },
                        { word: 'Esther', match: 'Queen of Persia' }
                    ]
                }
            }
        ];

        // Insert the specific games
        for (const gameData of gamesToSeed) {
            const gameId = `game-${gameData.type}-${gameData.date}`;
            await client.query(
                'INSERT INTO games (id, challenge_id, date, type, data) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, type = EXCLUDED.type',
                [gameId, challengeId, gameData.date, gameData.type, JSON.stringify(gameData.data)]
            );
            console.log(`Seeded ${gameData.type} for ${gameData.date}`);
        }

        console.log('Database seeded successfully!');
    } catch (error) {
        console.error('Seed error:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

if (process.argv[1] && process.argv[1].includes('seed.js')) {
    seedDatabase();
} else {
    seedDatabase();
}