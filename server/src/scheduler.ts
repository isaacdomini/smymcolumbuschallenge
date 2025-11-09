import cron from 'node-cron';
import pool from './db/pool.js';
import { sendDailyReminder } from './services/email.js';
import { sendPushNotification } from './services/push.js';

export const initScheduler = () => {
    console.log('Initializing daily reminder scheduler...');

    // Schedule task to run every day at 10:00 AM Eastern Time
    cron.schedule('0 10 * * *', async () => {
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
            const gameType = game.type.charAt(0).toUpperCase() + game.type.slice(1);

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