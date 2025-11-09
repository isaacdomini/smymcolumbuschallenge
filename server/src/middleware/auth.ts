import { Request, Response, NextFunction } from 'express';
import pool from '../db/pool';

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.headers['x-user-id'];

    if (!userId || typeof userId !== 'string') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const result = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0 || !result.rows[0].is_admin) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }
        next();
    } catch (error) {
        console.error('Admin auth error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};