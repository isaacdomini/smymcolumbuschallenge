import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.js';
import { getVapidPublicKey, saveSubscription } from '../services/push.js';
import { manualLog } from '../middleware/logger.js';

const router = Router();

// Helper to get 'YYYY-MM-DD' in Eastern Time
const getTodayEST = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
};

// --- HELPER: Score Calculation ---
const calculateScore = (game: any, submissionData: any, timeTaken: number, mistakes: number): number => {
    let baseScore = 0;
    const gameType = game.type;

    switch (gameType) {
        case 'wordle': {
            const maxGuesses = 6;
            if (mistakes >= maxGuesses) {
                baseScore = 0;
            } else {
                baseScore = (maxGuesses - mistakes) * 10;
            }
            break;
        }
        case 'connections': {
            const categoriesFound = submissionData?.categoriesFound ?? 0;
            baseScore = Math.max(0, (categoriesFound * 20) - (mistakes * 5));
            break;
        }
        case 'crossword': {
            const correct = submissionData?.correctCells ?? 0;
            const total = submissionData?.totalFillableCells ?? 1;
            if (total <= 0) {
                baseScore = 0;
            } else {
                const accuracyScore = Math.round((correct / total) * 70);
                const timeBonus = Math.max(0, 30 - Math.floor(timeTaken / 60));
                baseScore = Math.max(0, accuracyScore + timeBonus);
            }
            break;
        }
        default: {
             const timePenalty = Math.floor(timeTaken / 15);
             const mistakePenalty = mistakes * 10;
             baseScore = Math.max(0, 100 - mistakePenalty - timePenalty);
        }
    }

    // --- NEW: Apply Late Penalty ---
    // We get the current date in EST
    const today = new Date(getTodayEST() + 'T12:00:00Z'); // Use noon to avoid DST/timezone shift issues
    // Get the game date as YYYY-MM-DD in EST
    const gameDateStr = new Date(game.date).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const gameDate = new Date(gameDateStr + 'T12:00:00Z');

    const diffTime = today.getTime() - gameDate.getTime();
    // Calculate days late. If today is the game day, diffDays will be 0.
    const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    let finalScore = 0;
    // Only apply penalty if within the 5-day late window
    if (diffDays <= 5) {
        // 20% penalty per day late.
        // Day 0 (on time): 1.0 (1 - 0*0.2)
        // Day 1 late: 0.8 (1 - 1*0.2)
        // Day 5 late: 0.0 (1 - 5*0.2)
        const penaltyMultiplier = Math.max(0, 1.0 - (diffDays * 0.20));
        finalScore = Math.round(baseScore * penaltyMultiplier);
    }
    // If diffDays > 5, finalScore remains 0, as they shouldn't have been able to submit.

    return finalScore;
};
// --- LOGGING ENDPOINT ---
router.post('/log', async (req: Request, res: Response) => {
    try {
        const { path, userId, metadata } = req.body;
        await manualLog(req, path || 'unknown', 'VIEW', userId, metadata);
        res.status(200).send();
    } catch (error) {
        res.status(200).send();
    }
});

// --- Push Notification Endpoints ---
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

// --- Authentication Endpoints ---
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    if (!user.password) return res.status(401).json({ error: 'Account created before password auth. Please sign up again.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.is_verified) return res.status(401).json({ error: 'Please check your email to verify your account.' });

    delete user.password;
    delete user.verification_token;
    delete user.reset_password_token;
    delete user.reset_password_expires;
    res.json(user);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { name, email, password, emailNotifications = true } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
    
    const existingUserResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUserResult.rows.length > 0) {
      const existingUser = existingUserResult.rows[0];
      if (existingUser.is_verified) {
         return res.status(400).json({ error: 'User already exists' });
      } else {
        if (!existingUser.verification_token) {
          existingUser.verification_token = crypto.randomBytes(32).toString('hex');
          await pool.query('UPDATE users SET verification_token = $1, email_notifications = $2 WHERE id = $3', [existingUser.verification_token, emailNotifications, existingUser.id]);
        }
        await sendVerificationEmail(existingUser.email, existingUser.verification_token, req.get('host'));
        return res.status(201).json({ message: 'Account already registered. Verification email resent. Please check your email.' });
      }
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const userId = `user-${Date.now()}`;
    
    await pool.query(
      'INSERT INTO users (id, name, email, password, is_verified, verification_token, email_notifications) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [userId, name, email, hashedPassword, false, verificationToken, emailNotifications]
    );

    await sendVerificationEmail(email, verificationToken, req.get('host'));
    res.status(201).json({ message: 'Signup successful. Please check your email to verify your account.' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') return res.status(400).send('Invalid verification token.');

    const result = await pool.query('SELECT * FROM users WHERE verification_token = $1', [token]);
    if (result.rows.length === 0) return res.status(400).send('Invalid or expired verification token.');

    const user = result.rows[0];
    await pool.query('UPDATE users SET is_verified = true, verification_token = NULL WHERE id = $1', [user.id]);

    const frontendUrl = process.env.APP_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : '/');
    return res.redirect(`${frontendUrl}?verified=true`);
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).send('Internal server error during email verification.');
  }
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length > 0) {
        const token = crypto.randomBytes(32).toString('hex');
        const expires = Date.now() + 3600000; // 1 hour
        await pool.query('UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE email = $3', [token, expires, email]);
        await sendPasswordResetEmail(email, token, req.get('host'));
    }
    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and new password are required' });

    const userResult = await pool.query('SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > $2', [token, Date.now()]);
    if (userResult.rows.length === 0) return res.status(400).json({ error: 'Password reset token is invalid or has expired.' });

    const user = userResult.rows[0];
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await pool.query('UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2', [hashedPassword, user.id]);
    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- GAME DATA ENDPOINTS ---
router.get('/challenge', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    // Try to find currently active challenge first
    const result = await pool.query(
      'SELECT * FROM challenges WHERE start_date <= $1 AND end_date >= $1 ORDER BY start_date DESC LIMIT 1',
      [now]
    );
    
    if (result.rows.length > 0) {
      const challenge = result.rows[0];
      res.json({
        id: challenge.id,
        name: challenge.name,
        startDate: challenge.start_date.toISOString(),
        endDate: challenge.end_date.toISOString(),
      });
    } else {
      // If no active challenge, find the next upcoming one
      const upcomingResult = await pool.query(
        'SELECT * FROM challenges WHERE start_date > $1 ORDER BY start_date ASC LIMIT 1',
        [now]
      );
      if (upcomingResult.rows.length > 0) {
        const challenge = upcomingResult.rows[0];
        res.json({
          id: challenge.id,
          name: challenge.name,
          startDate: challenge.start_date.toISOString(),
          endDate: challenge.end_date.toISOString(),
        });
      } else {
         res.json(null);
      }
    }
  } catch (error) {
    console.error('Get challenge error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/challenge/:challengeId/daily', async (req: Request, res: Response) => {
  try {
    const { challengeId } = req.params;
    const today = getTodayEST();
    const result = await pool.query('SELECT * FROM games WHERE challenge_id = $1 AND DATE(date) = $2', [challengeId, today]);
    
    if (result.rows.length > 0) {
      const game = result.rows[0];
      res.json({
        id: game.id,
        challengeId: game.challenge_id,
        date: game.date.toISOString(),
        type: game.type,
        data: game.data,
      });
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Get daily game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/games/:gameId', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const result = await pool.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (result.rows.length > 0) {
      const game = result.rows[0];
      res.json({
        id: game.id,
        challengeId: game.challenge_id,
        date: game.date.toISOString(),
        type: game.type,
        data: game.data,
      });
    } else {
      res.status(404).json({ error: 'Game not found' });
    }
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/challenge/:challengeId/games', async (req: Request, res: Response) => {
  try {
    const { challengeId } = req.params;
    const result = await pool.query("SELECT * FROM games WHERE challenge_id = $1 ORDER BY date ASC", [challengeId]);
    const games = result.rows.map(game => ({
      id: game.id,
      challengeId: game.challenge_id,
      date: game.date.toISOString(),
      type: game.type,
      data: game.data,
    }));
    res.json(games);
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/submissions/user/:userId/challenge/:challengeId', async (req: Request, res: Response) => {
  try {
    const { userId, challengeId } = req.params;
    const result = await pool.query('SELECT * FROM game_submissions WHERE user_id = $1 AND challenge_id = $2', [userId, challengeId]);
    const submissions = result.rows.map(sub => ({
      id: sub.id,
      userId: sub.user_id,
      gameId: sub.game_id,
      challengeId: sub.challenge_id,
      startedAt: sub.started_at ? sub.started_at.toISOString() : new Date(sub.completed_at.getTime() - sub.time_taken * 1000).toISOString(),
      completedAt: sub.completed_at.toISOString(),
      timeTaken: sub.time_taken,
      mistakes: sub.mistakes,
      score: sub.score,
      submissionData: sub.submission_data,
    }));
    res.json(submissions);
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/submissions/user/:userId/game/:gameId', async (req: Request, res: Response) => {
  try {
    const { userId, gameId } = req.params;
    const result = await pool.query('SELECT * FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
    if (result.rows.length > 0) {
      const sub = result.rows[0];
      res.json({
        id: sub.id,
        userId: sub.user_id,
        gameId: sub.game_id,
        challengeId: sub.challenge_id,
        startedAt: sub.started_at ? sub.started_at.toISOString() : new Date(sub.completed_at.getTime() - sub.time_taken * 1000).toISOString(),
        completedAt: sub.completed_at.toISOString(),
        timeTaken: sub.time_taken,
        mistakes: sub.mistakes,
        score: sub.score,
        submissionData: sub.submission_data,
      });
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Get submission error:', error);
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

// --- SUBMIT GAME (with server-side scoring) ---
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const { userId, gameId, startedAt, timeTaken, mistakes, submissionData } = req.body;
    
    const gameResult = await pool.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameResult.rows.length === 0) return res.status(404).json({ error: 'Game not found' });
    
    const game = gameResult.rows[0];
    // Calculate score securely on server
    const today = new Date(getTodayEST() + 'T12:00:00Z');
    const gameDateStr = new Date(game.date).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const gameDate = new Date(gameDateStr + 'T12:00:00Z');
    const diffTime = today.getTime() - gameDate.getTime();
    const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    // Allow submission on day 5 (for 0 points), but block on day 6
    if (diffDays > 5) {
        return res.status(403).json({ error: 'This game is too old to submit.' });
    }

    const score = calculateScore(game, submissionData, timeTaken, mistakes);

    const existingSub = await pool.query('SELECT * FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, gameId]);

    if (existingSub.rows.length > 0) {
      // Only update if new score is better
      if (score > existingSub.rows[0].score) {
        const result = await pool.query(
          'UPDATE game_submissions SET started_at = $1, completed_at = $2, time_taken = $3, mistakes = $4, score = $5, submission_data = $6 WHERE id = $7 RETURNING *',
          [startedAt, new Date(), timeTaken, mistakes, score, JSON.stringify(submissionData), existingSub.rows[0].id]
        );
         return res.json(mapSubmission(result.rows[0]));
      } else {
        return res.json(mapSubmission(existingSub.rows[0]));
      }
    }
    
    const submissionId = `sub-${Date.now()}`;
    const result = await pool.query(
      'INSERT INTO game_submissions (id, user_id, game_id, challenge_id, started_at, completed_at, time_taken, mistakes, score, submission_data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [submissionId, userId, gameId, game.challenge_id, startedAt, new Date(), timeTaken, mistakes, score, JSON.stringify(submissionData)]
    );
    res.json(mapSubmission(result.rows[0]));

  } catch (error) {
    console.error('Submit game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper to map DB submission to API response
const mapSubmission = (sub: any) => ({
    id: sub.id,
    userId: sub.user_id,
    gameId: sub.game_id,
    challengeId: sub.challenge_id,
    startedAt: sub.started_at ? sub.started_at.toISOString() : new Date(sub.completed_at.getTime() - sub.time_taken * 1000).toISOString(),
    completedAt: sub.completed_at.toISOString(),
    timeTaken: sub.time_taken,
    mistakes: sub.mistakes,
    score: sub.score,
    submissionData: sub.submission_data,
});

// --- GAME STATE ENDPOINTS ---
router.get('/game-state/user/:userId/game/:gameId', async (req: Request, res: Response) => {
  try {
    const { userId, gameId } = req.params;
    const result = await pool.query('SELECT * FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
    if (result.rows.length > 0) {
      res.json({
        id: result.rows[0].id,
        userId: result.rows[0].user_id,
        gameId: result.rows[0].game_id,
        gameState: result.rows[0].game_state,
        updatedAt: result.rows[0].updated_at.toISOString(),
      });
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Get game state error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/game-state/user/:userId/game/:gameId', async (req: Request, res: Response) => {
  try {
    const { userId, gameId } = req.params;
    const { gameState } = req.body;
    const now = new Date();

    await pool.query(
      `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (user_id, game_id) DO UPDATE SET game_state = EXCLUDED.game_state, updated_at = EXCLUDED.updated_at`,
      [`progress-${userId}-${gameId}`, userId, gameId, JSON.stringify(gameState), now]
    );

    const result = await pool.query('SELECT * FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
    res.json({
        id: result.rows[0].id,
        userId: result.rows[0].user_id,
        gameId: result.rows[0].game_id,
        gameState: result.rows[0].game_state,
        updatedAt: result.rows[0].updated_at.toISOString(),
    });
  } catch (error) {
    console.error('Save game state error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/game-state/user/:userId/game/:gameId', async (req: Request, res: Response) => {
  try {
    const { userId, gameId } = req.params;
    await pool.query('DELETE FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
    res.status(204).send();
  } catch (error) {
    console.error('Clear game state error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;