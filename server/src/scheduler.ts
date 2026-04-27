import cron from 'node-cron';
import pool from './db/pool.js';
import { sendDailyReminder } from './services/email.js';
import { sendPushNotification, sendBatchPushNotification } from './services/push.js';
import { runDailyGameMaintenance } from './services/maintenance.js';
import { getGameName } from './utils/game.js';
import { generateDailyMessage, generateGameSuggestion } from './services/ollama.js';

const SUGGESTIONS_PER_GROUP = 3;

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

/**
 * Generate AI daily message suggestions for the next day across all groups.
 * Stores results in staging_daily_messages and notifies admins.
 */
export const runDailyMessageGeneration = async (targetDate?: string) => {
    const dateStr = targetDate || (() => {
        // Default: generate for tomorrow (in Eastern time)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    })();

    console.log(`[MessageGen] Starting AI daily message generation for date: ${dateStr}`);

    try {
        // Fetch all groups
        const groupsResult = await pool.query('SELECT id, name FROM groups ORDER BY name');
        const groups = groupsResult.rows;

        if (groups.length === 0) {
            console.log('[MessageGen] No groups found, skipping.');
            return { skipped: true, reason: 'No groups' };
        }

        const model = process.env.OLLAMA_MODEL || 'gemma4:e4b';
        let totalGenerated = 0;
        const errors: string[] = [];

        for (const group of groups) {
            console.log(`[MessageGen] Generating ${SUGGESTIONS_PER_GROUP} suggestions for group "${group.name}" (${group.id})...`);

            for (let i = 0; i < SUGGESTIONS_PER_GROUP; i++) {
                try {
                    const blocks = await generateDailyMessage(group.name, dateStr);
                    const id = `staging-${dateStr}-${group.id}-${Date.now()}-${i}`;

                    await pool.query(
                        `INSERT INTO staging_daily_messages (id, date, group_id, content, status, model)
                         VALUES ($1, $2, $3, $4, 'pending', $5)`,
                        [id, dateStr, group.id, JSON.stringify(blocks), model]
                    );

                    totalGenerated++;
                    console.log(`[MessageGen] Saved suggestion ${i + 1}/${SUGGESTIONS_PER_GROUP} for group "${group.name}"`);
                } catch (err: any) {
                    const errMsg = `Failed to generate suggestion ${i + 1} for group "${group.name}": ${err.message}`;
                    console.error(`[MessageGen] ${errMsg}`);
                    errors.push(errMsg);
                }
            }
        }

        console.log(`[MessageGen] Generation complete. ${totalGenerated} suggestions created.`);

        // Notify all admins via push notification
        try {
            const adminResult = await pool.query(
                'SELECT id FROM users WHERE is_admin = true AND is_verified = true'
            );

            if (adminResult.rows.length > 0) {
                const adminIds = adminResult.rows.map((r: any) => r.id);
                await sendBatchPushNotification(adminIds, {
                    title: '📖 Daily Messages Ready for Review',
                    body: `${totalGenerated} AI-generated suggestions are ready to review for ${dateStr}. Tap to open admin panel.`,
                    url: '/admin'
                });
                console.log(`[MessageGen] Notified ${adminIds.length} admin(s).`);
            }
        } catch (notifyErr) {
            console.error('[MessageGen] Failed to notify admins:', notifyErr);
        }

        return {
            skipped: false,
            date: dateStr,
            groups: groups.length,
            totalGenerated,
            errors: errors.length > 0 ? errors : undefined
        };

    } catch (error) {
        console.error('[MessageGen] Fatal error during message generation:', error);
        throw error;
    }
};

const ALLOWED_GAME_TYPES = [
    'wordle', 'wordle_advanced', 'connections', 'crossword', 
    'match_the_word', 'verse_scramble', 'who_am_i', 'word_search', 
    'property_matcher', 'book_guesser'
];

export const runDailyGameGenerationJob = async () => {
    console.log('[GameGen] Starting daily AI game generation job...');
    const model = process.env.OLLAMA_MODEL || 'gemma4:e4b';
    let totalGenerated = 0;
    const errors: string[] = [];

    try {
        // Clean up stale staging games (older than 30 days)
        const cleanupResult = await pool.query(
            "DELETE FROM staging_games WHERE generated_at < NOW() - INTERVAL '30 days'"
        );
        if (cleanupResult.rowCount && cleanupResult.rowCount > 0) {
            console.log(`[GameGen] Cleaned up ${cleanupResult.rowCount} stale staging games.`);
        }

        // For each allowed game type, ensure there is at least 1 pending suggestion
        for (const type of ALLOWED_GAME_TYPES) {
            const pendingResult = await pool.query(
                "SELECT COUNT(*) FROM staging_games WHERE type = $1 AND status = 'pending'",
                [type]
            );

            if (parseInt(pendingResult.rows[0].count) === 0) {
                console.log(`[GameGen] Generating new game suggestion for type: ${type}`);
                
                // Fetch examples
                const examplesResult = await pool.query(
                    "SELECT data FROM games WHERE type = $1 ORDER BY created_at DESC LIMIT 2",
                    [type]
                );
                const examples = examplesResult.rows.map((r: any) => r.data);

                try {
                    const gameData = await generateGameSuggestion(type, examples);
                    const id = `staging-game-${type}-${Date.now()}`;
                    
                    await pool.query(
                        `INSERT INTO staging_games (id, type, data, status, model)
                         VALUES ($1, $2, $3, 'pending', $4)`,
                        [id, type, JSON.stringify(gameData), model]
                    );
                    
                    totalGenerated++;
                    console.log(`[GameGen] Successfully staged new game for ${type}.`);
                } catch (err: any) {
                    console.error(`[GameGen] Failed to generate game for ${type}: ${err.message}`);
                    errors.push(`Failed for ${type}: ${err.message}`);
                }
            } else {
                console.log(`[GameGen] Found existing pending suggestion for ${type}. Skipping.`);
            }
        }

        console.log(`[GameGen] Generation complete. ${totalGenerated} new games created.`);

        if (totalGenerated > 0) {
            // Notify admins
            const adminResult = await pool.query(
                'SELECT id FROM users WHERE is_admin = true AND is_verified = true'
            );

            if (adminResult.rows.length > 0) {
                const adminIds = adminResult.rows.map((r: any) => r.id);
                await sendBatchPushNotification(adminIds, {
                    title: '🎮 New Game Suggestions Ready',
                    body: `${totalGenerated} AI-generated game suggestions are ready for review. Tap to view.`,
                    url: '/admin'
                });
            }
        }

        return { skipped: false, totalGenerated, errors: errors.length > 0 ? errors : undefined };
    } catch (err) {
        console.error('[GameGen] Fatal error during game generation:', err);
        throw err;
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

    // 3. Daily AI Message Generation at 2:00 AM Eastern Time
    // Generates suggestions for the NEXT day so admins can review them before morning
    cron.schedule('0 2 * * *', async () => {
        console.log('[Scheduler] Running daily AI message generation...');
        try {
            await runDailyMessageGeneration();
        } catch (err) {
            console.error('[Scheduler] Error in AI message generation:', err);
        }
    }, {
        scheduled: true,
        timezone: 'America/New_York'
    });

    // 4. Daily AI Game Generation at 3:00 AM Eastern Time
    cron.schedule('0 3 * * *', async () => {
        console.log('[Scheduler] Running daily AI game generation...');
        try {
            await runDailyGameGenerationJob();
        } catch (err) {
            console.error('[Scheduler] Error in AI game generation:', err);
        }
    }, {
        scheduled: true,
        timezone: 'America/New_York'
    });
};