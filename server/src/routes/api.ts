import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';

const router = Router();

// Note: Password authentication is intentionally simplified for this MVP.
// In a production system, passwords should be hashed and validated properly.

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Signup endpoint
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { name, email } = req.body;
    
    // Check if user exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Create new user
    const userId = `user-${Date.now()}`;
    const result = await pool.query(
      'INSERT INTO users (id, name, email) VALUES ($1, $2, $3) RETURNING *',
      [userId, name, email]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current challenge
router.get('/challenge', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const result = await pool.query(
      'SELECT * FROM challenges WHERE start_date <= $1 AND end_date >= $1 LIMIT 1',
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
      res.json(null);
    }
  } catch (error) {
    console.error('Get challenge error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get daily game
router.get('/challenge/:challengeId/daily', async (req: Request, res: Response) => {
  try {
    const { challengeId } = req.params;
    const today = new Date().toISOString().split('T')[0];
    
    const result = await pool.query(
      'SELECT * FROM games WHERE challenge_id = $1 AND DATE(date) = $2',
      [challengeId, today]
    );
    
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

// Get games for challenge
router.get('/challenge/:challengeId/games', async (req: Request, res: Response) => {
  try {
    const { challengeId } = req.params;
    const now = new Date();
    
    const result = await pool.query(
      'SELECT * FROM games WHERE challenge_id = $1 AND date <= $2 ORDER BY date ASC',
      [challengeId, now]
    );
    
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

// Get submissions for user
router.get('/submissions/user/:userId/challenge/:challengeId', async (req: Request, res: Response) => {
  try {
    const { userId, challengeId } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM game_submissions WHERE user_id = $1 AND challenge_id = $2',
      [userId, challengeId]
    );
    
    const submissions = result.rows.map(sub => ({
      id: sub.id,
      userId: sub.user_id,
      gameId: sub.game_id,
      challengeId: sub.challenge_id,
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

// Get submission for today
router.get('/submissions/user/:userId/game/:gameId', async (req: Request, res: Response) => {
  try {
    const { userId, gameId } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM game_submissions WHERE user_id = $1 AND game_id = $2',
      [userId, gameId]
    );
    
    if (result.rows.length > 0) {
      const sub = result.rows[0];
      res.json({
        id: sub.id,
        userId: sub.user_id,
        gameId: sub.game_id,
        challengeId: sub.challenge_id,
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

// Get leaderboard
router.get('/challenge/:challengeId/leaderboard', async (req: Request, res: Response) => {
  try {
    const { challengeId } = req.params;
    
    const result = await pool.query(
      `SELECT 
        u.id as user_id,
        u.name,
        u.email,
        SUM(gs.score) as total_score
      FROM game_submissions gs
      JOIN users u ON gs.user_id = u.id
      WHERE gs.challenge_id = $1
      GROUP BY u.id, u.name, u.email
      ORDER BY total_score DESC`,
      [challengeId]
    );
    
    const leaderboard = result.rows.map(row => ({
      id: `leaderboard-${row.user_id}`,
      userId: row.user_id,
      challengeId,
      score: row.total_score,
      user: {
        id: row.user_id,
        name: row.name,
        email: row.email,
      },
      gameId: '',
      completedAt: '',
      timeTaken: 0,
      mistakes: 0,
    }));
    
    res.json(leaderboard);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit game
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const { userId, gameId, timeTaken, mistakes, submissionData } = req.body;
    
    // Get the game to find challenge ID
    const gameResult = await pool.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const game = gameResult.rows[0];
    
    // Calculate score
    const timePenalty = Math.floor(timeTaken / 15);
    const mistakePenalty = mistakes * 10;
    const score = Math.max(0, 100 - mistakePenalty - timePenalty);
    
    // Create submission
    const submissionId = `sub-${Date.now()}`;
    const result = await pool.query(
      'INSERT INTO game_submissions (id, user_id, game_id, challenge_id, completed_at, time_taken, mistakes, score, submission_data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [submissionId, userId, gameId, game.challenge_id, new Date(), timeTaken, mistakes, score, JSON.stringify(submissionData)]
    );
    
    const sub = result.rows[0];
    res.json({
      id: sub.id,
      userId: sub.user_id,
      gameId: sub.game_id,
      challengeId: sub.challenge_id,
      completedAt: sub.completed_at.toISOString(),
      timeTaken: sub.time_taken,
      mistakes: sub.mistakes,
      score: sub.score,
      submissionData: sub.submission_data,
    });
  } catch (error) {
    console.error('Submit game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
