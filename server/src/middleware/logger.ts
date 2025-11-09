import { Request, Response, NextFunction } from 'express';
import pool from '../db/pool';

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

// Helper to extract the real client IP, handling various proxy scenarios
function getClientIp(req: Request): string | undefined {
    // 1. Check standard X-Forwarded-For header
    // It can contain multiple IPs: "client, proxy1, proxy2". We want the first one.
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (typeof xForwardedFor === 'string') {
        return xForwardedFor.split(',')[0].trim();
    } else if (Array.isArray(xForwardedFor)) {
        return xForwardedFor[0].trim();
    }

    // 2. Check Cloudflare specific header if applicable
    const cfConnectingIp = req.headers['cf-connecting-ip'];
    if (typeof cfConnectingIp === 'string') {
        return cfConnectingIp;
    }

    // 3. Fallback to Express req.ip (which uses 'trust proxy' setting) or the direct socket IP
    return req.ip || req.socket.remoteAddress;
}

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

    // Get IP address using robust extractor
    const ip = getClientIp(req);
    const userAgent = req.get('User-Agent') || null;
    const method = req.method;

    // Placeholder for potential future geolocation lookup
    // const geoData = await lookupGeoIP(ip); 
    const metadata = null; 

    let userId = null;

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