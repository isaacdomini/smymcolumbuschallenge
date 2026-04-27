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

router.post('/user/deprecation-email', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // Check if the user exists to get their email
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userEmail = userResult.rows[0].email;

    // Check if we already sent an email
    const logResult = await pool.query(
      "SELECT created_at FROM notification_logs WHERE user_id = $1 AND type = 'app_deprecation_email' AND status = 'sent' ORDER BY created_at DESC LIMIT 1",
      [userId]
    );

    if (logResult.rows.length > 0) {
      // Email was already sent
      return res.json({ status: 'already_sent', timestamp: logResult.rows[0].created_at });
    }

    // Send the email
    await sendAppDeprecationEmail(userEmail, userId);

    // We fetch the latest log just to return the exact timestamp, though 'sent_now' is enough for frontend.
    res.json({ status: 'sent_now', timestamp: new Date().toISOString() });

  } catch (error) {
    console.error('App deprecation email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/request-deletion', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    // Credentials are valid, send email to admin
    await sendAccountDeletionRequestEmail(user.email, user.id, user.name);

    res.json({ message: 'Your account deletion request has been submitted. An administrator will process it within 48 hours.' });

  } catch (error) {
    console.error('Account deletion request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authUserId = req.headers['x-user-id'];

    if (userId !== authUserId) {
      return res.status(403).json({ error: 'Forbidden: You can only update your own profile.' });
    }

    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    const result = await pool.query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING *',
      [name, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = result.rows[0];
    delete user.password;
    delete user.verification_token;
    delete user.reset_password_token;
    delete user.reset_password_expires;
    res.json(user);

  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authUserId = req.headers['x-user-id'];

    if (userId !== authUserId) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own account.' });
    }

    // Use a transaction to ensure all data is deleted
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM game_submissions WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM game_progress WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
      await client.query('COMMIT');

      res.status(204).send();
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
