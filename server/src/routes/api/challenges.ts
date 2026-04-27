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

router.get('/challenge', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    // Convert now to EST string for comparison with DB dates (which are YYYY-MM-DD or timestamps)
    // Actually, DB dates for start_date/end_date are typically timestamps.
    const groupId = (req.query.groupId as string) || 'default';

    // 1. Try to find currently active challenge (excluding default, unless looking for default group?)
    // Logic: Active challenge for specific group
    const result = await pool.query(
      "SELECT * FROM challenges WHERE start_date <= $1 AND end_date >= $1 AND group_id = $2 ORDER BY start_date DESC LIMIT 1",
      [now, groupId]
    );

    if (result.rows.length > 0) {
      const challenge = result.rows[0];
      return res.json({
        id: challenge.id,
        name: challenge.name,
        startDate: challenge.start_date.toISOString(),
        endDate: challenge.end_date.toISOString(),
      });
    }

    // 2. If no active, find the next upcoming one
    const upcomingResult = await pool.query(
      "SELECT * FROM challenges WHERE start_date > $1 AND group_id = $2 ORDER BY start_date ASC LIMIT 1",
      [now, groupId]
    );

    if (upcomingResult.rows.length > 0) {
      const challenge = upcomingResult.rows[0];

      // Find previous challenge for leaderboard history
      const prevResult = await pool.query(
        "SELECT id FROM challenges WHERE end_date < $1 AND group_id = $2 ORDER BY end_date DESC LIMIT 1",
        [now, groupId]
      );
      const prviousChallengeId = prevResult.rows.length > 0 ? prevResult.rows[0].id : undefined;

      return res.json({
        id: challenge.id,
        name: challenge.name,
        startDate: challenge.start_date.toISOString(),
        endDate: challenge.end_date.toISOString(),
        previousChallengeId: prviousChallengeId
      });
    }

    // 3. Fallback to Default Challenge if looking at default group
    if (groupId === 'default') {
      const defaultResult = await pool.query("SELECT * FROM challenges WHERE id = 'challenge-default'");
      if (defaultResult.rows.length > 0) {
        const challenge = defaultResult.rows[0];
        return res.json({
          id: challenge.id,
          name: challenge.name,
          startDate: challenge.start_date.toISOString(),
          endDate: challenge.end_date.toISOString(),
        });
      }
    }

    res.json(null);
  } catch (error) {
    console.error('Get challenge error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/user/challenges', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // Find all challenges where user has at least one submission
    // and also include the default challenge if they played it? 
    // Actually just getting all challenges they have submissions for is enough.
    const result = await pool.query(`
      SELECT DISTINCT c.id, c.name, c.start_date, c.end_date 
      FROM challenges c
      JOIN games g ON g.challenge_id = c.id
      JOIN game_submissions gs ON gs.game_id = g.id
      WHERE gs.user_id = $1
      ORDER BY c.start_date DESC
    `, [userId]);

    res.json(result.rows.map(row => ({
      id: row.id,
      name: row.name,
      startDate: row.start_date.toISOString(),
      endDate: row.end_date.toISOString()
    })));
  } catch (error) {
    console.error('Error fetching user challenges:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/challenges/:id/wordbank', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { words } = req.body; // Expecting array of strings

    // Basic validation
    if (!Array.isArray(words)) {
      return res.status(400).json({ error: 'Words must be an array of strings' });
    }

    await pool.query(
      'UPDATE challenges SET word_bank = $1 WHERE id = $2',
      [JSON.stringify(words), id]
    );

    res.json({ success: true, count: words.length });
  } catch (error) {
    console.error('Update word bank error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/challenge/:challengeId/daily', async (req: Request, res: Response) => {
  try {
    const { challengeId } = req.params;
    const userId = req.headers['x-user-id'] as string;
    const today = getTodayEST();
    const result = await pool.query('SELECT * FROM games WHERE challenge_id = $1 AND DATE(date) = $2', [challengeId, today]);

    if (result.rows.length > 0) {
      // Resolve all games found for today
      const games = await Promise.all(result.rows.map(async (game) => {
        return resolveGameData(game, userId);
      }));
      res.json(games);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Get daily game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/challenge/:challengeId/games', async (req: Request, res: Response) => {
  try {
    const { challengeId } = req.params;
    console.log('Hit /challenge/:challengeId/games', challengeId);
    const userId = req.headers['x-user-id'] as string; // We need user ID to resolve games correctly

    const result = await pool.query("SELECT * FROM games WHERE challenge_id = $1 ORDER BY date ASC", [challengeId]);

    // Resolve all games (this might be slow if many wordle_advanced games, but usually it's few)
    const games = await Promise.all(result.rows.map(async (game) => {
      return resolveGameData(game, userId);
    }));

    res.json(games);
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/challenge/:challengeId/leaderboard', async (req: Request, res: Response) => {
  try {
    const { challengeId } = req.params;
    const result = await pool.query(
      `SELECT u.id as user_id, u.name, u.email, SUM(gs.score) as total_score, COUNT(gs.id) as games_played
      FROM game_submissions gs JOIN users u ON gs.user_id = u.id
      WHERE gs.challenge_id = $1 GROUP BY u.id, u.name, u.email ORDER BY total_score DESC`,
      [challengeId]
    );
    const leaderboard = result.rows.map(row => ({
      id: `leaderboard-${row.user_id}`,
      userId: row.user_id,
      challengeId,
      score: parseInt(row.total_score, 10),
      user: { id: row.user_id, name: row.name, email: row.email },
      gamesPlayed: parseInt(row.games_played, 10),
      gameId: '', startedAt: '', completedAt: '', timeTaken: 0, mistakes: 0,
    }));
    res.json(leaderboard);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
