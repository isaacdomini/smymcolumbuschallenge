import cron from 'node-cron';
import pool from './db/pool.js';
import { sendDailyReminder } from './services/email.js';
import { sendPushNotification } from './services/push.js';

import { getGameName } from './utils/game.js';

import { resolveGameData } from './routes/api.js';

export const initScheduler = () => {
    console.log('Initializing scheduler...');

    // 1. Daily Maintenance Job at 12:01 AM EST
    // Ensures a game exists for today and pre-assigns words to users
    cron.schedule('1 0 * * *', async () => {
        console.log('Running daily game maintenance job...');
        try {
            // Calculate today in Eastern Time
            const now = new Date();
            const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

            // 1. Check if a game exists for today
            // We need to find the active challenge first
            const challengeResult = await pool.query(
                'SELECT id FROM challenges WHERE start_date <= $1 AND end_date >= $1 LIMIT 1',
                [now]
            );

            if (challengeResult.rows.length === 0) {
                console.log('No active challenge for today, skipping game creation.');
                return;
            }
            const challengeId = challengeResult.rows[0].id;

            const gameResult = await pool.query(
                'SELECT id, type, data FROM games WHERE challenge_id = $1 AND DATE(date) = $2',
                [challengeId, todayStr]
            );

            let gameId;
            let gameType;
            let gameData;

            if (gameResult.rows.length === 0) {
                console.log(`No game found for today (${todayStr}). Creating default Wordle Bank game.`);

                // For Wordle Bank, we don't insert solutions here; 
                // they are fetched from the challenge's word_bank at runtime in resolveGameData.
                const newGameResult = await pool.query(
                    `INSERT INTO games (id, challenge_id, date, type, data, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                     RETURNING id, type, data`,
                    [`game-${challengeId}-${todayStr}`, challengeId, todayStr, 'wordle_bank', {}]
                );

                gameId = newGameResult.rows[0].id;
                gameType = newGameResult.rows[0].type;
                gameData = newGameResult.rows[0].data;
            } else {
                gameId = gameResult.rows[0].id;
                gameType = gameResult.rows[0].type;
                gameData = gameResult.rows[0].data;
                console.log(`Game already exists for today: ${gameType} (${gameId})`);
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
            console.log(`Daily maintenance complete. Assigned ${assignedCount} games.`);

        } catch (error) {
            console.error('Error running daily maintenance job:', error);
        }
    }, {
        scheduled: true,
        timezone: "America/New_York"
    });

    // 2. Daily User Reminders at 7:00 AM and 6:00 PM Eastern Time
    cron.schedule('0 7,18 * * *', async () => {
        console.log('Running daily reminder job...');
        try {
            const now = new Date();
            // Use Eastern time for the date check
            const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

            const challengeResult = await pool.query(
                'SELECT id FROM challenges WHERE start_date <= $1 AND end_date >= $1 LIMIT 1',
                [now]
            );

            if (challengeResult.rows.length === 0) {
                console.log('No active challenge today, skipping reminders.');
                return;
            }
            const challengeId = challengeResult.rows[0].id;

            const gameResult = await pool.query(
                'SELECT id, type FROM games WHERE challenge_id = $1 AND DATE(date) = $2',
                [challengeId, todayStr]
            );

            if (gameResult.rows.length === 0) {
                console.log('No game scheduled for today, skipping reminders.');
                return;
            }
            const game = gameResult.rows[0];
            const gameType = getGameName(game.type);

            const usersToRemind = await pool.query(`
                SELECT u.id, u.name, u.email, u.email_notifications 
                FROM users u
                LEFT JOIN game_submissions gs ON u.id = gs.user_id AND gs.game_id = $1
                WHERE u.is_verified = true AND gs.id IS NULL
            `, [game.id]);

            console.log(`Found ${usersToRemind.rows.length} potential users to remind for ${game.type} on ${todayStr}.`);

            const notificationPromises = usersToRemind.rows.map(async (user) => {
                const promises = [];
                // Send email if opted in
                if (user.email_notifications) {
                    promises.push(sendDailyReminder(user.email, user.name, gameType));
                }
                // ALWAYS try to send push notification if they have a subscription (handled by service)
                promises.push(sendPushNotification(user.id, {
                    title: "Daily Challenge Reminder",
                    body: `Hi ${user.name}, time for today's ${gameType}!`
                }));
                return Promise.all(promises);
            });

            await Promise.all(notificationPromises);
            console.log('Daily reminder job completed.');

        } catch (error) {
            console.error('Error running daily reminder job:', error);
        }
    }, {
        scheduled: true,
        timezone: "America/New_York"
    });
};