import cron from 'node-cron';
import pool from './db/pool.js';
import { sendDailyReminder } from './services/email.js';
import { sendPushNotification } from './services/push.js';
import { runDailyGameMaintenance } from './services/maintenance.js';

import { getGameName } from './utils/game.js';

import { resolveGameData } from './routes/api.js';

export const initScheduler = () => {
    console.log('Initializing scheduler...');

    // 1. Daily Maintenance Job at 12:01 AM EST
    // Ensures a game exists for today and pre-assigns words to users
    // 1. Daily Maintenance Job at 12:01 AM EST
    // Ensures a game exists for today and pre-assigns words to users
    cron.schedule('1 0 * * *', async () => {
        await runDailyGameMaintenance();
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

            const games = gameResult.rows;
            const gameIds = games.map(g => g.id);
            const totalGames = games.length;

            // Find users who have completed FEWER games than the total available today
            const usersToRemind = await pool.query(`
                SELECT u.id, u.name, u.email, u.email_notifications 
                FROM users u
                WHERE u.is_verified = true
                AND (
                    SELECT COUNT(*)
                    FROM game_submissions gs
                    WHERE gs.user_id = u.id
                    AND gs.game_id = ANY($1::uuid[])
                ) < $2
            `, [gameIds, totalGames]);

            console.log(`Found ${usersToRemind.rows.length} potential users to remind for ${totalGames} game(s) on ${todayStr}.`);

            const notificationPromises = usersToRemind.rows.map(async (user) => {
                const promises = [];

                let gameLabel = "";
                if (totalGames === 1) {
                    gameLabel = getGameName(games[0].type);
                } else {
                    gameLabel = "daily challenges";
                }

                // Send email if opted in
                if (user.email_notifications) {
                    promises.push(sendDailyReminder(user.email, user.name, gameLabel));
                }
                // ALWAYS try to send push notification if they have a subscription (handled by service)
                promises.push(sendPushNotification(user.id, {
                    title: "Daily Challenge Reminder",
                    body: `Hi ${user.name}, time for today's ${gameLabel}!`
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