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
const router = Router();

router.get('/daily-message', async (req: Request, res: Response) => {
  try {
    const date = (req.query.date as string) || getTodayEST();
    const groupId = (req.query.groupId as string) || 'default';

    const result = await pool.query(
      'SELECT * FROM daily_messages WHERE date = $1 AND group_id = $2',
      [date, groupId]
    );

    if (result.rows.length === 0) {
      return res.json(null);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching daily message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/banner-messages', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      // If no user ID, maybe return system messages that are not user-specific?
      // For now, let's require a user ID to track dismissals properly, or just return system messages.
      // Let's assume we want to show system messages even to guests, but tracking dismissal might be hard without ID.
      // If we rely on client-side storage for guests, we can just return all active system messages.
      // But the requirement says "log this too in the DB". So we likely need a user ID.
      // If the user is not logged in, we can't log dismissal in DB easily unless we use a device ID.
      // Let's assume this is for logged-in users or we just return system messages and client handles dismissal for guests (but DB log won't happen).
      // For this implementation, I'll fetch messages for the user if provided.
    }

    // Query:
    // 1. Active messages
    // 2. Not expired (expires_at IS NULL OR expires_at > NOW())
    // 3. Type is 'system' OR (type is 'user' AND target_user_id = userId)
    // 4. NOT in user_message_dismissals for this userId

    let query = `
      SELECT bm.* 
      FROM banner_messages bm
      LEFT JOIN user_message_dismissals umd ON bm.id = umd.message_id AND umd.user_id = $1
      LEFT JOIN banner_message_targets bmt ON bm.id = bmt.message_id
      WHERE bm.active = true 
      AND (bm.expires_at IS NULL OR bm.expires_at > NOW())
      AND umd.message_id IS NULL
      AND (
        bm.type = 'system' 
        OR (bm.type = 'user' AND bmt.user_id = $1)
      )
    `;

    const params: any[] = [userId];

    const result = await pool.query(query, params);

    // Map snake_case database fields to camelCase for frontend
    const mappedMessages = result.rows.map(msg => ({
      id: msg.id,
      content: msg.content,
      type: msg.type,
      linkUrl: msg.link_url,
      linkText: msg.link_text,
      createdAt: msg.created_at,
      priority: msg.priority,
      active: msg.active,
      expiresAt: msg.expires_at
    }));

    res.json(mappedMessages);
  } catch (error) {
    console.error('Fetch banner messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/banner-messages/:id/dismiss', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({ error: 'User ID required to dismiss message' });
    }

    await pool.query(
      'INSERT INTO user_message_dismissals (user_id, message_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Dismiss banner message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
