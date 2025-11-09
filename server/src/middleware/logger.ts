import { Request, Response, NextFunction } from 'express';
import pool from '../db/pool.js';

// List of file extensions to ignore in logs to reduce noise
const IGNORED_EXTENSIONS = [
  '.js', '.jsx', '.css', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', 
  '.woff', '.woff2', '.ttf', '.eot', '.map', '.json'
];

// Specific paths to ignore
const IGNORED_PATHS = [
    '/favicon.ico',
    '/service-worker.js'
];

// Helper to extract the real client IP, handling various proxy scenarios
export function getClientIp(req: Request): string | undefined {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (typeof xForwardedFor === 'string') {
        return xForwardedFor.split(',')[0].trim();
    } else if (Array.isArray(xForwardedFor)) {
        return xForwardedFor[0].trim();
    }
    const cfConnectingIp = req.headers['cf-connecting-ip'];
    if (typeof cfConnectingIp === 'string') {
        return cfConnectingIp;
    }
    return req.ip || req.socket.remoteAddress;
}

export const visitLogger = (req: Request, res: Response, next: NextFunction) => {
    // STOP LOGGING API ROUTES AUTOMATICALLY
    if (req.path.startsWith('/api')) {
        return next();
    }

    // Fire and forget - don't await this so we don't slow down the actual request
    logVisit(req).catch(err => {
        console.error("Error logging visit:", err.message);
    });
    next();
};

async function logVisit(req: Request) {
    const path = req.path;

    if (IGNORED_PATHS.includes(path) || IGNORED_EXTENSIONS.some(ext => path.endsWith(ext))) {
        return;
    }

    const ip = getClientIp(req);
    const userAgent = req.get('User-Agent') || null;
    const method = req.method;
    const metadata = null; 
    let userId = null; // Middleware doesn't easily know auth state without parsing tokens, handled better by frontend explicit logging

    try {
        await pool.query(
            'INSERT INTO visit_logs (ip_address, user_agent, path, method, user_id, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
            [ip, userAgent, path, method, userId, metadata]
        );
    } catch (error) {
        // console.error("Logging failed", error);
    }
}

// Export a function to manually log from other parts of the app (like API endpoints)
export const manualLog = async (req: Request, path: string, method: string, userId?: string | null, metadata?: any) => {
     try {
        const ip = getClientIp(req);
        const userAgent = req.get('User-Agent') || null;
        await pool.query(
            'INSERT INTO visit_logs (ip_address, user_agent, path, method, user_id, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
            [ip, userAgent, path, method, userId || null, metadata ? JSON.stringify(metadata) : null]
        );
    } catch (error) {
        console.error("Manual logging failed", error);
    }
}