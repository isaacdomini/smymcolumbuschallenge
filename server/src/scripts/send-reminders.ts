import pool from '../db/pool.js';
import { sendPushNotification } from '../services/push.js';
import { getGameName } from '../utils/game.js';

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
      console.log('No games scheduled for today, skipping reminders.');
      process.exit(0);
    }

    const games = gameResult.rows;
    const gameIds = games.map(g => g.id);
    const totalGames = games.length;

    // Find users who have completed FEWER games than the total available today
    const usersToRemind = await pool.query(`
            SELECT u.id, u.name
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

    if (usersToRemind.rows.length === 0) {
      console.log('Everyone has completed all games! No reminders needed.');
      process.exit(0);
    }

    const notificationPromises = usersToRemind.rows.map(async (user) => {
      console.log(`Sending reminder to ${user.name} (${user.id})...`);

      let bodyText = "";
      if (totalGames === 1) {
        bodyText = `Hi ${user.name}, time for today's ${getGameName(games[0].type)}!`;
      } else {
        bodyText = `Hi ${user.name}, time for today's daily challenges!`;
      }

      return sendPushNotification(user.id, {
        title: "Daily Challenge Reminder",
        body: bodyText
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
