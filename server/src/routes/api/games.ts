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

router.post('/games/:gameId/check', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { guess } = req.body;
    const userId = req.headers['x-user-id'] as string;

    const result = await pool.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Game not found' });
    const game = result.rows[0];

    // Get full game data with solution
    const resolvedGame = await resolveGameData(game, userId, false);
    const gameData = resolvedGame.data;
    const gameType = resolvedGame.type;

    if (gameType === 'wordle' || gameType === 'wordle_advanced' || gameType === 'wordle_bank') {
      const solution = gameData.solution.toUpperCase();
      const guessUpper = (guess as string).toUpperCase();
      const statuses: ('correct' | 'present' | 'absent')[] = Array(guessUpper.length).fill('absent');
      const solutionChars = solution.split('');
      const guessChars = guessUpper.split('');

      // First pass: correct
      guessChars.forEach((char, i) => {
        if (char === solutionChars[i]) {
          statuses[i] = 'correct';
          solutionChars[i] = ''; // Mark as used
        }
      });

      // Second pass: present
      guessChars.forEach((char, i) => {
        if (statuses[i] !== 'correct' && solutionChars.includes(char)) {
          statuses[i] = 'present';
          const index = solutionChars.indexOf(char);
          solutionChars[index] = ''; // Mark as used
        }
      });

      return res.json({ result: statuses });

    } else if (gameType === 'connections') {
      const guessWords = (guess as string[]).sort();
      const categories = gameData.categories;

      const match = categories.find((cat: any) => {
        const catWords = [...cat.words].sort();
        return JSON.stringify(catWords) === JSON.stringify(guessWords);
      });

      if (match) {
        return res.json({ correct: true, group: match });
      }

      // Check one away
      let oneAway = false;
      for (const cat of categories) {
        const catWords = cat.words;
        const intersection = guessWords.filter(w => catWords.includes(w));
        if (intersection.length === 3) {
          oneAway = true;
          break;
        }
      }

      return res.json({ correct: false, oneAway });

    } else if (gameType === 'match_the_word') {
      const { word, match } = guess as { word: string, match: string };
      const pair = gameData.pairs.find((p: any) => p.word === word && p.match === match);
      return res.json({ correct: !!pair });

    } else if (gameType === 'who_am_i') {
      const char = (guess as string).toUpperCase();
      const answer = gameData.answer.toUpperCase();
      const positions: number[] = [];
      for (let i = 0; i < answer.length; i++) {
        if (answer[i] === char) positions.push(i);
      }
      return res.json({ correct: positions.length > 0, positions });

    } else if (gameType === 'verse_scramble') {
      const guessWords = guess as string[];
      const correctWords = gameData.verse.split(' ');

      const normalize = (str: string) => str.replace(/[^a-zA-Z]/g, '').toLowerCase();
      const guessNorm = guessWords.map(normalize).join('');
      const correctNorm = correctWords.map(normalize).join('');

      const correct = guessNorm === correctNorm;
      return res.json({ correct });
    }

    res.json({ error: 'Game type not supported for checking' });

  } catch (error) {
    console.error('Check answer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/games/:gameId', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const userId = req.headers['x-user-id'] as string;

    const result = await pool.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (result.rows.length > 0) {
      const game = result.rows[0];
      const resolvedGame = await resolveGameData(game, userId);
      res.json(resolvedGame);
    } else {
      res.status(404).json({ error: 'Game not found' });
    }
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/game-state/user/:userId/game/:gameId', async (req: Request, res: Response) => {
  try {
    const { userId, gameId } = req.params;
    const result = await pool.query('SELECT * FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
    if (result.rows.length > 0) {
      res.json({
        id: result.rows[0].id,
        userId: result.rows[0].user_id,
        gameId: result.rows[0].game_id,
        gameState: stripSensitiveGameState(result.rows[0].game_state),
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

    // Preserve assignedWord if it exists in the DB but not in the new state
    // This is critical for Wordle Advanced where assignedWord is set by the server
    const existingResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);

    let finalGameState = gameState;
    if (existingResult.rows.length > 0) {
      const existingState = existingResult.rows[0].game_state;
      const keysToPreserve = [
        'assignedWord',
        'assignedSolution',
        'assignedVerse',
        'assignedCategories',
        'assignedCrosswordIndex',
        'assignedWhoAmI',
        'assignedPairs',
        'assignedWordSearchIndex'
      ];

      console.log(`[DEBUG] Existing keys: ${Object.keys(existingState).join(', ')}`);
      console.log(`[DEBUG] Final keys before preserve: ${Object.keys(finalGameState).join(', ')}`);
      keysToPreserve.forEach(key => {
        if (existingState[key] && !finalGameState[key]) {
          console.log(`[DEBUG] Preserving key ${key}:`, existingState[key]);
          finalGameState[key] = existingState[key];
        } else {
          if (existingState[key]) console.log(`[DEBUG] NOT preserving ${key}. Final has it? ${!!finalGameState[key]}`);
        }
      });
    }

    await pool.query(
      `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (user_id, game_id) DO UPDATE SET game_state = EXCLUDED.game_state, updated_at = EXCLUDED.updated_at`,
      [`progress-${userId}-${gameId}`, userId, gameId, JSON.stringify(finalGameState), now]
    );

    const result = await pool.query('SELECT * FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
    res.json({
      id: result.rows[0].id,
      userId: result.rows[0].user_id,
      gameId: result.rows[0].game_id,
      gameState: stripSensitiveGameState(result.rows[0].game_state),
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
    res.status(244).send();
  } catch (error) {
    console.error('Clear game state error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
