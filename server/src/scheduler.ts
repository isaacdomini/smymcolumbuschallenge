import cron from 'node-cron';
import pool from './db/pool.js';
import { sendDailyReminder } from './services/email.js';
import { sendPushNotification } from './services/push.js';
import { runDailyGameMaintenance } from './services/maintenance.js';
import { getGameName } from './utils/game.js';

// Exported so it can be triggered manually via the admin API
export const runDailyReminderJob = async () => {
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
            return { skipped: true, reason: 'No active challenge' };
        }
        const challengeId = challengeResult.rows[0].id;

        const gameResult = await pool.query(
            'SELECT id, type FROM games WHERE challenge_id = $1 AND DATE(date) = $2',
            [challengeId, todayStr]
        );

        if (gameResult.rows.length === 0) {
            console.log('No game scheduled for today, skipping reminders.');
            return { skipped: true, reason: 'No game scheduled today' };
        }

        const games = gameResult.rows;
        const gameIds = games.map((g: any) => g.id);
        const totalGames = games.length;

        // Find users who have completed FEWER games than the total available today.
        // game_id is VARCHAR(255) — cast as text[] not uuid[]
        const usersToRemind = await pool.query(`
            SELECT u.id, u.name, u.email, u.email_notifications 
            FROM users u
            WHERE u.is_verified = true
            AND (
                SELECT COUNT(*)
                FROM game_submissions gs
                WHERE gs.user_id = u.id
                AND gs.game_id = ANY($1::text[])
            ) < $2
        `, [gameIds, totalGames]);

        const userCount = usersToRemind.rows.length;
        console.log(`Found ${userCount} users to remind for ${totalGames} game(s) on ${todayStr}.`);

        const gameLabel = totalGames === 1 ? getGameName(games[0].type) : 'daily challenges';

        // Process users sequentially to avoid saturating the DB connection pool
        for (const user of usersToRemind.rows) {
            try {
                const promises = [];

                if (user.email_notifications) {
                    promises.push(sendDailyReminder(user.email, user.name, gameLabel));
                }
                promises.push(sendPushNotification(user.id, {
                    title: 'Daily Challenge Reminder',
                    body: `Hi ${user.name}, time for today's ${gameLabel}!`
                }));

                await Promise.all(promises);
            } catch (err) {
                console.error(`Failed to send reminder to user ${user.id}:`, err);
            }
        }

        console.log('Daily reminder job completed.');
        return { skipped: false, usersNotified: userCount, date: todayStr };

    } catch (error) {
        console.error('Error running daily reminder job:', error);
        throw error;
    }
};

export const initScheduler = () => {
    console.log('Initializing scheduler...');

    // 1. Daily Maintenance Job at 12:01 AM EST
    // Ensures a game exists for today and pre-assigns words to users
    cron.schedule('1 0 * * *', async () => {
        await runDailyGameMaintenance();
    }, {
        scheduled: true,
        timezone: 'America/New_York'
    });

    // 2. Daily User Reminders at 7:00 AM and 6:00 PM Eastern Time
    cron.schedule('0 7,18 * * *', runDailyReminderJob, {
        scheduled: true,
        timezone: 'America/New_York'
    });
};