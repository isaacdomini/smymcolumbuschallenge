import cron from 'node-cron';
import pool from './db/pool.js';
import { sendDailyReminder } from './services/email.js';

export const initScheduler = () => {
    console.log('Initializing daily reminder scheduler...');

    // Schedule task to run every day at 22:00 UTC (which is 5:00 PM EST / 6:00 PM EDT)
    // This gives users most of the day to play before reminding them.
    cron.schedule('0 22 * * *', async () => {
        console.log('Running daily reminder job...');
        try {
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];

            // 1. Get today's active challenge
            const challengeResult = await pool.query(
                'SELECT id FROM challenges WHERE start_date <= $1 AND end_date >= $1 LIMIT 1',
                [now]
            );

            if (challengeResult.rows.length === 0) {
                console.log('No active challenge today, skipping reminders.');
                return;
            }
            const challengeId = challengeResult.rows[0].id;

            // 2. Get today's game
            const gameResult = await pool.query(
                'SELECT id, type FROM games WHERE challenge_id = $1 AND DATE(date) = $2',
                [challengeId, todayStr]
            );

            if (gameResult.rows.length === 0) {
                 console.log('No game scheduled for today, skipping reminders.');
                 return;
            }
            const game = gameResult.rows[0];

            // 3. Find verified users who have NOT submitted a score for today's game AND have enabled notifications
            // We join users with submissions, filtering for where the submission IS NULL
            const usersToRemind = await pool.query(`
                SELECT u.id, u.name, u.email 
                FROM users u
                LEFT JOIN game_submissions gs ON u.id = gs.user_id AND gs.game_id = $1
                WHERE u.is_verified = true 
                AND u.email_notifications = true
                AND gs.id IS NULL
            `, [game.id]);

            console.log(`Found ${usersToRemind.rows.length} users to remind for ${game.type} on ${todayStr}.`);

            // 4. Send emails (in parallel, but consider rate limits for large user bases)
            // For now, simple Promise.all is fine for smaller groups.
            await Promise.all(usersToRemind.rows.map(user => {
                return sendDailyReminder(user.email, user.name, game.type.charAt(0).toUpperCase() + game.type.slice(1));
            }));

            console.log('Daily reminder job completed.');

        } catch (error) {
            console.error('Error running daily reminder job:', error);
        }
    });
};