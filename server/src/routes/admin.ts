import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';
import { sendBatchPushNotification } from '../services/push.js';

const router = Router();

// Apply admin requirement to all routes in this router
router.use(requireAdmin);

// Get dashboard stats
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const [users, playsToday, totalPlays, upcomingGames] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM users'),
            pool.query('SELECT COUNT(*) FROM game_submissions WHERE DATE(completed_at) = CURRENT_DATE'),
            pool.query('SELECT COUNT(*) FROM game_submissions'),
            pool.query('SELECT COUNT(*) FROM games WHERE date > CURRENT_DATE')
        ]);

        res.json({
            totalUsers: parseInt(users.rows[0].count),
            playsToday: parseInt(playsToday.rows[0].count),
            totalPlays: parseInt(totalPlays.rows[0].count),
            upcomingGames: parseInt(upcomingGames.rows[0].count)
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- USERS ---

router.get('/users', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        const result = await pool.query(
            'SELECT id, name, email, is_verified, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        );

        // Map snake_case DB to camelCase for frontend
        const users = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            email: row.email,
            isVerified: row.is_verified,
            isAdmin: row.is_admin,
            createdAt: row.created_at
        }));

        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user (e.g. promote to admin, verify)
router.put('/users/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { isAdmin, isVerified } = req.body;

        // Dynamic query building based on what's provided
        const fields = [];
        const values = [];
        let idx = 1;

        if (isAdmin !== undefined) {
            fields.push(`is_admin = $${idx++}`);
            values.push(isAdmin);
        }
        if (isVerified !== undefined) {
            fields.push(`is_verified = $${idx++}`);
            values.push(isVerified);
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(id);
        const result = await pool.query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`,
            values
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User updated successfully' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete user (admin only)
router.delete('/users/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Delete related data first (cascading delete)
        await pool.query('DELETE FROM game_submissions WHERE user_id = $1', [id]);
        await pool.query('DELETE FROM game_progress WHERE user_id = $1', [id]);

        // Delete the user
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- LOGS ---

router.get('/logs', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 100;
        const offset = parseInt(req.query.offset as string) || 0;

        const result = await pool.query(
            'SELECT * FROM visit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- SUBMISSIONS ---

router.get('/submissions', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;
        const gameId = req.query.gameId as string;
        const gameType = req.query.gameType as string;
        const userId = req.query.userId as string;

        let query = `
            SELECT gs.*, u.name as user_name, u.email as user_email, g.type as game_type, g.date as game_date 
            FROM game_submissions gs
            JOIN users u ON gs.user_id = u.id
            JOIN games g ON gs.game_id = g.id
        `;
        const params: any[] = [];
        const conditions: string[] = [];

        if (gameId) {
            conditions.push(`gs.game_id = $${params.length + 1}`);
            params.push(gameId);
        }
        if (gameType) {
            conditions.push(`g.type = $${params.length + 1}`);
            params.push(gameType);
        }
        if (userId) {
            conditions.push(`gs.user_id = $${params.length + 1}`);
            params.push(userId);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ` ORDER BY gs.completed_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Count total for pagination
        let countQuery = `
            SELECT COUNT(*) 
            FROM game_submissions gs
            JOIN games g ON gs.game_id = g.id
        `;
        if (conditions.length > 0) {
            countQuery += ' WHERE ' + conditions.join(' AND ');
        }
        // Reuse params for count, omitting limit/offset which are last 2
        const countResult = await pool.query(countQuery, params.slice(0, -2));

        res.json({
            submissions: result.rows.map(row => ({
                id: row.id,
                userId: row.user_id,
                userName: row.user_name,
                userEmail: row.user_email,
                gameId: row.game_id,
                gameType: row.game_type,
                gameDate: row.game_date,
                score: row.score,
                timeTaken: row.time_taken,
                mistakes: row.mistakes,
                completedAt: row.completed_at,
                submissionData: row.submission_data
            })),
            total: parseInt(countResult.rows[0].count)
        });
    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- GAMES ---

// Create a new game
router.post('/games', async (req: Request, res: Response) => {
    try {
        const { challengeId, date, type, data } = req.body;

        if (!challengeId || !date || !type || !data) {
            return res.status(400).json({ error: 'Missing required game fields' });
        }

        const gameId = `game-${type}-${date}`;

        await pool.query(
            `INSERT INTO games (id, challenge_id, date, type, data) 
             VALUES ($1, $2, $3, $4, $5) 
             ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, type = EXCLUDED.type, challenge_id = EXCLUDED.challenge_id`,
            [gameId, challengeId, date, type, JSON.stringify(data)]
        );

        res.json({ message: 'Game created successfully', gameId });
    } catch (error) {
        console.error('Error creating game:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get games for a challenge
router.get('/games', async (req: Request, res: Response) => {
    try {
        const { challengeId } = req.query;
        if (!challengeId) {
            return res.status(400).json({ error: 'Missing challengeId parameter' });
        }

        const result = await pool.query('SELECT * FROM games WHERE challenge_id = $1 ORDER BY date ASC', [challengeId]);
        res.json(result.rows.map(row => ({
            id: row.id,
            challengeId: row.challenge_id,
            date: row.date,
            type: row.type,
            data: row.data
        })));
    } catch (error) {
        console.error('Error fetching games:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a single game
router.get('/games/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM games WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Game not found' });
        }

        const row = result.rows[0];
        res.json({
            id: row.id,
            challengeId: row.challenge_id,
            date: row.date,
            type: row.type,
            data: row.data
        });
    } catch (error) {
        console.error('Error fetching game:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a game
router.delete('/games/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM games WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Game not found' });
        }

        res.json({ message: 'Game deleted successfully' });
    } catch (error) {
        console.error('Error deleting game:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- CHALLENGES ---

// Get all challenges
router.get('/challenges', async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM challenges ORDER BY start_date DESC');
        res.json(result.rows.map(row => ({
            id: row.id,
            name: row.name,
            startDate: row.start_date,
            endDate: row.end_date
        })));
    } catch (error) {
        console.error('Error fetching challenges:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a challenge
router.post('/challenges', async (req: Request, res: Response) => {
    try {
        const { id, name, startDate, endDate } = req.body;
        if (!id || !name || !startDate || !endDate) {
            return res.status(400).json({ error: 'Missing required challenge fields' });
        }

        await pool.query(
            'INSERT INTO challenges (id, name, start_date, end_date) VALUES ($1, $2, $3, $4)',
            [id, name, startDate, endDate]
        );

        res.status(201).json({ message: 'Challenge created successfully', id });
    } catch (error: any) {
        if (error.code === '23505') { // unique_violation
            return res.status(409).json({ error: 'A challenge with this ID already exists.' });
        }
        console.error('Error creating challenge:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update a challenge
router.put('/challenges/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, startDate, endDate } = req.body;

        const result = await pool.query(
            'UPDATE challenges SET name = $1, start_date = $2, end_date = $3 WHERE id = $4 RETURNING *',
            [name, startDate, endDate, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Challenge not found' });
        }

        res.json({ message: 'Challenge updated successfully' });
    } catch (error) {
        console.error('Error updating challenge:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a challenge
router.delete('/challenges/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Check if games exist for this challenge first
        const gamesResult = await pool.query('SELECT COUNT(*) FROM games WHERE challenge_id = $1', [id]);
        if (parseInt(gamesResult.rows[0].count) > 0) {
            return res.status(409).json({ error: 'Cannot delete challenge because it contains games. Delete the games first.' });
        }

        const result = await pool.query('DELETE FROM challenges WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Challenge not found' });
        }

        res.json({ message: 'Challenge deleted successfully' });
    } catch (error) {
        console.error('Error deleting challenge:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// --- DAILY MESSAGES ---

// Get all daily messages (paginated)
router.get('/daily-messages', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        const result = await pool.query(
            'SELECT * FROM daily_messages ORDER BY date DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching daily messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create or update a daily message
router.post('/daily-messages', async (req: Request, res: Response) => {
    try {
        const { date, content } = req.body;

        if (!date || !content) {
            return res.status(400).json({ error: 'Date and content are required' });
        }

        const id = `msg-${date}`;

        await pool.query(
            `INSERT INTO daily_messages (id, date, content) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (date) DO UPDATE SET content = EXCLUDED.content`,
            [id, date, content]
        );

        res.json({ message: 'Daily message saved successfully', id });
    } catch (error) {
        console.error('Error saving daily message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a daily message
router.delete('/daily-messages/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM daily_messages WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        res.json({ message: 'Daily message deleted successfully' });
    } catch (error) {
        console.error('Error deleting daily message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// --- SUPPORT TICKETS ---

// Get all tickets
router.get('/support/tickets', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;
        const status = req.query.status as string;

        let query = 'SELECT * FROM support_tickets';
        const params: any[] = [];

        if (status) {
            query += ' WHERE status = $1';
            params.push(status);
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add note to ticket
router.post('/support/tickets/:id/notes', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { note, userId } = req.body; // userId of the admin adding the note

        if (!note) {
            return res.status(400).json({ error: 'Note content is required' });
        }

        const noteId = `note-${Date.now()}`;

        await pool.query(
            'INSERT INTO ticket_notes (id, ticket_id, user_id, note) VALUES ($1, $2, $3, $4)',
            [noteId, id, userId, note]
        );

        res.status(201).json({ message: 'Note added successfully', noteId });
    } catch (error) {
        console.error('Error adding ticket note:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update ticket status
router.patch('/support/tickets/:id/status', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['open', 'resolved', 'closed'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const result = await pool.query(
            'UPDATE support_tickets SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        res.json({ message: 'Ticket status updated', ticket: result.rows[0] });
    } catch (error) {
        console.error('Error updating ticket status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- BANNER MESSAGES ---

// Create a banner message
router.post('/banner-messages', async (req: Request, res: Response) => {
    try {
        const { content, type, targetUserIds, expiresAt, linkUrl, linkText, priority } = req.body;

        if (!content || !type) {
            return res.status(400).json({ error: 'Content and type are required' });
        }

        if (type !== 'system' && type !== 'user') {
            return res.status(400).json({ error: 'Type must be "system" or "user"' });
        }

        if (type === 'user' && (!targetUserIds || !Array.isArray(targetUserIds) || targetUserIds.length === 0)) {
            return res.status(400).json({ error: 'Target user IDs array is required for user-specific messages' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const result = await client.query(
                'INSERT INTO banner_messages (content, type, expires_at, link_url, link_text, priority) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                [content, type, expiresAt || null, linkUrl || null, linkText || null, priority || 'normal']
            );

            const messageId = result.rows[0].id;

            if (type === 'user' && targetUserIds && targetUserIds.length > 0) {
                const values = targetUserIds.map((userId: string) => `(${messageId}, '${userId}')`).join(',');
                await client.query(`INSERT INTO banner_message_targets (message_id, user_id) VALUES ${values}`);
            }

            await client.query('COMMIT');

            // Send Push Notification
            // Don't await this so we don't block the response
            const pushTitle = priority === 'high' ? 'Important Message' : 'New Message';
            // Strip markdown for push body (simple regex or just send content)
            // For simplicity, we'll just send the content. Ideally we'd strip markdown.
            const pushBody = content.replace(/[*_~`]/g, '');

            sendBatchPushNotification(
                type === 'user' ? targetUserIds : null,
                {
                    title: pushTitle,
                    body: pushBody,
                    url: linkUrl || '/'
                }
            );

            res.status(201).json({ message: 'Banner message created', id: messageId });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error creating banner message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// --- FEATURE FLAGS ---

// Get all feature flags
router.get('/feature-flags', async (req: Request, res: Response) => {
    try {
        const { getAllFeatureFlags } = await import('../utils/featureFlags.js');
        const flags = await getAllFeatureFlags();
        res.json(flags);
    } catch (error) {
        console.error('Error fetching feature flags:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update a feature flag
router.put('/feature-flags/:key', async (req: Request, res: Response) => {
    try {
        const { key } = req.params;
        const { enabled } = req.body;
        const { updateFeatureFlag } = await import('../utils/featureFlags.js');

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: 'Enabled status must be a boolean' });
        }

        const updatedFlag = await updateFeatureFlag(key, enabled);

        if (!updatedFlag) {
            return res.status(404).json({ error: 'Feature flag not found' });
        }

        res.json(updatedFlag);
    } catch (error) {
        console.error('Error updating feature flag:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;