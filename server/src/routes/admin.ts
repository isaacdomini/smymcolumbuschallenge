import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';

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

export default router;