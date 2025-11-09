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

// Get all challenges (for dropdowns)
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

export default router;