import { Router, Request, Response } from 'express';
import pool from '../../db/pool.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { sendVerificationEmail, sendPasswordResetEmail, sendAccountDeletionRequestEmail, sendTicketCreatedEmail, sendAdminTicketNotification, sendCheatingAlert, sendAppDeprecationEmail } from '../../services/email.js';
import { getVapidPublicKey, saveSubscription } from '../../services/push.js';
import { manualLog, getClientIp } from '../../middleware/logger.js';
import { getFeatureFlag } from '../../utils/featureFlags.js';
import { authenticateToken, authenticateOptional } from '../../middleware/auth.js';
import { getTodayEST, calculateScore, resolveGameData, shuffleArray } from '../../utils/gameUtils.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback';

import fs from 'fs';
import path from 'path';
let appVersion = 'unknown';
try {
  const pkgPath = path.join(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  appVersion = pkg.version;
} catch (e) {
  console.error('Failed to read package.json version dynamically.', e);
}
const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.get('/version', (req, res) => {
  res.json({ version: appVersion });
});

router.post('/log', async (req: Request, res: Response) => {
  try {
    const { path, userId, metadata } = req.body;
    await manualLog(req, path || 'unknown', 'VIEW', userId, metadata);
    res.status(200).send();
  } catch (error) {
    res.status(200).send();
  }
});

router.post('/log-visit', async (req: Request, res: Response) => {
  try {
    const { path, appName, userId, metadata, ip, userAgent } = req.body;

    // Use provided IP/UA or fallback to request details
    const finalIp = ip || getClientIp(req) || null;
    const finalUA = userAgent || req.get('User-Agent') || null;

    // Construct metadata with appName if provided
    const finalMetadata = {
      ...(metadata || {}),
      source: 'external_api',
      appName: appName || 'unknown'
    };

    await pool.query(
      'INSERT INTO visit_logs (ip_address, user_agent, path, method, user_id, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
      [finalIp, finalUA, path || 'external', 'VIEW', userId || null, JSON.stringify(finalMetadata)]
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('External log visit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

router.post('/subscribe', async (req, res) => {
  try {
    const { userId, subscription, token, platform } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    if (subscription) {
      // This is a Web Push subscription
      await saveSubscription(userId, subscription, 'web');
      res.status(201).json({ message: 'Web subscription saved successfully' });

    } else if (token && platform) {
      // This is a Native Push subscription
      await saveSubscription(userId, token, platform);
      res.status(201).json({ message: 'Native subscription saved successfully' });

    } else {
      return res.status(400).json({ error: 'Missing subscription or token/platform data' });
    }

  } catch (error: any) {
    // Handle duplicate token errors gracefully
    if (error.code === '23505') { // unique_violation
      if (error.constraint === 'push_subscriptions_endpoint_key' || error.constraint === 'unique_device_token') {
        return res.status(200).json({ message: 'Subscription already exists' });
      }
    }
    console.error('Subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/feature-flags/public', async (req: Request, res: Response) => {
  try {
    const { getAllFeatureFlags } = await import('../utils/featureFlags.js');
    const flags = await getAllFeatureFlags();
    // Filter to only safe/public flags - USER REQUEST: Allow all flags
    // const publicKeys = ['maintenance_mode', 'christmas_flair'];
    const publicFlags = flags.reduce((acc: any, curr) => {
      acc[curr.key] = curr.enabled;
      return acc;
    }, {});

    // Ensure maintenance_mode is present (default to false if missing)
    if (publicFlags.maintenance_mode === undefined) {
      publicFlags.maintenance_mode = false;
    }

    res.json(publicFlags);
  } catch (error) {
    console.error('Error fetching public feature flags:', error);
    // Default safe response
    res.json({ maintenance_mode: false });
  }
});

router.post('/support/ticket', async (req: Request, res: Response) => {
  try {
    const { email, issue, userId } = req.body;

    if (!email || !issue) {
      return res.status(400).json({ error: 'Email and issue are required.' });
    }

    const ticketId = `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // If userId is provided, verify it exists (optional, but good for data integrity)
    // For now, just insert it.

    await pool.query(
      'INSERT INTO support_tickets (id, user_id, email, issue) VALUES ($1, $2, $3, $4)',
      [ticketId, userId || null, email, issue]
    );

    // Send emails
    // 1. To User
    await sendTicketCreatedEmail(email, ticketId, issue.substring(0, 200) + (issue.length > 200 ? '...' : ''));

    // 2. To Admin
    await sendAdminTicketNotification(ticketId, email, issue);

    res.status(201).json({ message: 'Support ticket created successfully.', ticketId });

  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/support/ticket/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const ticketResult = await pool.query('SELECT * FROM support_tickets WHERE id = $1', [id]);

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const ticket = ticketResult.rows[0];

    // Fetch notes (only public ones? Or all? Usually admin notes are internal or visible. 
    // Requirement says "Admin user can... add notes... An email is sent to the user... with a link to the issue status".
    // Usually support systems show the conversation. Let's assume notes are replies.)
    const notesResult = await pool.query(
      `SELECT tn.*, u.name as admin_name 
       FROM ticket_notes tn 
       LEFT JOIN users u ON tn.user_id = u.id 
       WHERE tn.ticket_id = $1 
       ORDER BY tn.created_at ASC`,
      [id]
    );

    res.json({
      ticket: {
        id: ticket.id,
        email: ticket.email,
        issue: ticket.issue,
        status: ticket.status,
        createdAt: ticket.created_at,
        updatedAt: ticket.updated_at
      },
      notes: notesResult.rows.map(note => ({
        id: note.id,
        note: note.note,
        adminName: note.admin_name || 'Support Team',
        createdAt: note.created_at
      }))
    });

  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
