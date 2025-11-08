import { Request, Response, NextFunction } from 'express';
import pool from '../db/pool.js';

// List of file extensions to ignore in logs to reduce noise
const IGNORED_EXTENSIONS = [
  '.js', '.jsx', '.css', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', 
  '.woff', '.woff2', '.ttf', '.eot', '.map', '.json'
];

// Specific paths to ignore (e.g. health checks, service worker if it polls frequently)
const IGNORED_PATHS = [
    '/favicon.ico',
    '/service-worker.js'
];

export const visitLogger = (req: Request, res: Response, next: NextFunction) => {
    // Fire and forget - don't await this so we don't slow down the actual request
    logVisit(req).catch(err => {
        console.error("Error logging visit:", err.message);
    });
    next();
};

async function logVisit(req: Request) {
    const path = req.path;

    // Filter out static assets and ignored paths
    if (IGNORED_PATHS.includes(path) || IGNORED_EXTENSIONS.some(ext => path.endsWith(ext))) {
        return;
    }

    // Get IP address - req.ip works best if 'trust proxy' is set in express
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent') || null;
    const method = req.method;

    // Placeholder for potential future geolocation lookup
    // const geoData = await lookupGeoIP(ip); 
    const metadata = null; 

    // Try to extract user ID if standard Authorization header is present (basic check)
    // This is a simplistic check and might need adjustment based on exactly how auth is handled in all routes
    // A more robust way is to use this logger *after* auth middleware for authenticated routes,
    // but putting it first ensures we catch *all* visitors.
    let userId = null;
    // If you ever want to log authenticated users, you'd extract it here, possibly by decoding the JWT 
    // if it's available in the header, without fully verifying it to save time, 
    // relying on the actual auth middleware for real security.

    try {
        await pool.query(
            'INSERT INTO visit_logs (ip_address, user_agent, path, method, user_id, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
            [ip, userAgent, path, method, userId, metadata]
        );
    } catch (error) {
        // Catch specific PG errors if needed, e.g., invalid IP format if it's not a standard IPv4/6
        // For now, just let the main catcher handle it.
        throw error;
    }
}