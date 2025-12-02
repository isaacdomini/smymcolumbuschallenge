import pool from '../db/pool.js';
import { sendPushNotification } from '../services/push.js';

const sendReminders = async () => {
  console.log('Starting manual reminder script...');
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
      process.exit(0);
    }
    const challengeId = challengeResult.rows[0].id;

    const gameResult = await pool.query(
      'SELECT id, type FROM games WHERE challenge_id = $1 AND DATE(date) = $2',
      [challengeId, todayStr]
    );

    if (gameResult.rows.length === 0) {
      console.log('No game scheduled for today, skipping reminders.');
      process.exit(0);
    }
    const game = gameResult.rows[0];
    const gameType = game.type.charAt(0).toUpperCase() + game.type.slice(1);

    const usersToRemind = await pool.query(`
            SELECT u.id, u.name
            FROM users u
            LEFT JOIN game_submissions gs ON u.id = gs.user_id AND gs.game_id = $1
            WHERE u.is_verified = true AND gs.id IS NULL
        `, [game.id]);

    console.log(`Found ${usersToRemind.rows.length} potential users to remind for ${game.type} on ${todayStr}.`);

    if (usersToRemind.rows.length === 0) {
      console.log('Everyone has played! No reminders needed.');
      process.exit(0);
    }

    const notificationPromises = usersToRemind.rows.map(async (user) => {
      console.log(`Sending reminder to ${user.name} (${user.id})...`);
      return sendPushNotification(user.id, {
        title: "Daily Challenge Reminder",
        body: `Hi ${user.name}, time for today's ${gameType}!`
      });
    });

    await Promise.all(notificationPromises);
    console.log('Reminder script completed successfully.');
    process.exit(0);

  } catch (error) {
    console.error('Error running reminder script:', error);
    process.exit(1);
  }
};

sendReminders();
