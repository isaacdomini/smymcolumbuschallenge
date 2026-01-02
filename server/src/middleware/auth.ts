import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                isAdmin: boolean;
            };
        }
    }
}

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable must be set');
}
const JWT_SECRET = process.env.JWT_SECRET; // In production, use env var

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) {
            return res.status(403).json({ error: 'Forbidden: Invalid token' });
        }
        req.user = user;
        next();
    });
};

export const authenticateOptional = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (!err) {
            req.user = user;
        }
        next();
    });
};

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    // First ensure the user is authenticated
    authenticateToken(req, res, async () => {
        // Check if the user is an admin based on the token payload or DB
        // Using DB for extra security in case admin status was revoked since token issue
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const result = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
            if (result.rows.length === 0 || !result.rows[0].is_admin) {
                return res.status(403).json({ error: 'Forbidden: Admin access required' });
            }
            next();
        } catch (error) {
            console.error('Admin auth error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
};