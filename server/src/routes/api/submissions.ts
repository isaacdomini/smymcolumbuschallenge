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

router.post('/report-cheating', async (req: Request, res: Response) => {
  try {
    const { userId, details } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    // Log to database
    await pool.query(
      'INSERT INTO visit_logs (user_id, path, method, metadata) VALUES ($1, $2, $3, $4)',
      [userId, 'DEV_TOOLS_DETECTED', 'ALERT', JSON.stringify({ details })]
    );

    // Get user details for email
    const result = await pool.query('SELECT name, email FROM users WHERE id = $1', [userId]);
    if (result.rows.length > 0) {
      const { name, email } = result.rows[0];
      // Send email alert
      await sendCheatingAlert(email, name, details);
    }

    res.status(200).json({ message: 'Reported' });
  } catch (error) {
    console.error('Cheating report error:', error);
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

    // Resolve game data WITH solution for validation
    const resolvedGame = await resolveGameData(game, userId, false);
    const gameData = resolvedGame.data;
    const gameType = resolvedGame.type;

    let calculatedMistakes = mistakes;
    let feedback: any = {};

    if (gameType === 'wordle' || gameType === 'wordle_advanced') {
      const solution = gameData.solution.toUpperCase();
      const guesses = submissionData.guesses.filter((g: string) => g);
      calculatedMistakes = 0;
      guesses.forEach((guess: string) => {
        if (guess.toUpperCase() !== solution) {
          calculatedMistakes++;
        }
      });
      // If user failed all guesses, ensure mistakes reflects that (max 6)
      if (guesses.length === 6 && guesses[5].toUpperCase() !== solution) {
        calculatedMistakes = 6;
      }
    } else if (gameType === 'crossword') {
      const userGrid = submissionData.grid;
      const { rows, cols, acrossClues, downClues } = gameData;

      // Reconstruct solution grid
      const solutionGrid: (string | null)[][] = Array(rows).fill(null).map(() => Array(cols).fill(null));
      const allClues: any[] = [...acrossClues, ...downClues];
      allClues.forEach(clue => {
        for (let i = 0; i < clue.answer.length; i++) {
          const r = clue.direction === 'across' ? clue.row : clue.row + i;
          const c = clue.direction === 'across' ? clue.col + i : clue.col;
          if (solutionGrid[r] && c < cols) {
            solutionGrid[r][c] = clue.answer[i];
          }
        }
      });

      calculatedMistakes = 0;
      let correctCells = 0;
      let totalFillableCells = 0;
      const incorrectCells: { row: number, col: number }[] = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (solutionGrid[r][c] !== null) {
            totalFillableCells++;
            const userVal = userGrid[r][c];
            if (userVal === solutionGrid[r][c]) {
              correctCells++;
            } else if (userVal) {
              calculatedMistakes++;
              incorrectCells.push({ row: r, col: c });
            }
          }
        }
      }

      submissionData.correctCells = correctCells;
      submissionData.totalFillableCells = totalFillableCells;
      submissionData.incorrectCells = incorrectCells; // Save for review
      feedback.incorrectCells = incorrectCells;
    } else if (gameType === 'connections') {
      // Validate connections
      if (submissionData.foundGroups && Array.isArray(submissionData.foundGroups)) {
        const validGroups = submissionData.foundGroups.filter((groupName: string) => {
          return gameData.categories.some((cat: any) => cat.name === groupName);
        });

        // Update submission data with only valid groups
        submissionData.foundGroups = validGroups;
        submissionData.categoriesFound = validGroups.length;
      }

      // Persist assignedCategories
      const progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
      if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedCategories) {
        submissionData.assignedCategories = progressResult.rows[0].game_state.assignedCategories;
      }

    } else if (gameType === 'match_the_word') {
      if (submissionData.foundPairs && Array.isArray(submissionData.foundPairs)) {
        // foundPairs is list of words.
        // Verify each word exists in gameData.pairs
        const validPairs = submissionData.foundPairs.filter((word: string) => {
          return gameData.pairs.some((p: any) => p.word === word);
        });
        submissionData.foundPairs = validPairs;
        submissionData.foundPairsCount = validPairs.length;
      }

      // Persist assignedPairs
      const progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
      if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedPairs) {
        submissionData.assignedPairs = progressResult.rows[0].game_state.assignedPairs;
      }

    } else if (gameType === 'who_am_i') {
      if (submissionData.guessedLetters && Array.isArray(submissionData.guessedLetters)) {
        const answer = gameData.answer.toUpperCase();
        const guesses = submissionData.guessedLetters.map((l: string) => l.toUpperCase());

        // Re-calculate mistakes based on guesses
        calculatedMistakes = 0;
        const uniqueAnswerChars = new Set(answer.split('').filter((c: string) => /[A-Z]/.test(c)));
        const correctGuesses = new Set();

        guesses.forEach((guess: string) => {
          if (answer.includes(guess)) {
            correctGuesses.add(guess);
          } else {
            calculatedMistakes++;
          }
        });

        // Cap mistakes at 6 as per game rules
        if (calculatedMistakes > 6) calculatedMistakes = 6;

        // Validate solved status
        const isSolved = uniqueAnswerChars.size === correctGuesses.size;
        submissionData.solved = isSolved;
      }
    } else if (gameType === 'verse_scramble') {
      if (submissionData.placedWords && Array.isArray(submissionData.placedWords)) {
        const submittedVerse = submissionData.placedWords.join(' ');
        const correctVerse = gameData.verse;

        const isCorrect = submittedVerse === correctVerse;
        submissionData.completed = isCorrect;

        // If not correct, they haven't completed it.
        if (!isCorrect) {
          // Maybe set mistakes to 1 to indicate failure if they claimed success?
          // But Verse Scramble doesn't really have "mistakes" in the same way.
          // Just ensure completed is false.
        }
      }
    }


    const score = calculateScore(resolvedGame, submissionData, timeTaken, calculatedMistakes);

    // Check for assigned crossword index in game_progress to persist it
    let finalSubmissionData = submissionData;
    if (game.type === 'crossword') {
      const progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
      if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedCrosswordIndex !== undefined) {
        finalSubmissionData = {
          ...submissionData,
          assignedCrosswordIndex: progressResult.rows[0].game_state.assignedCrosswordIndex
        };
      }
    } else if (game.type === 'word_search') {
      const progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
      if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedWordSearchIndex !== undefined) {
        finalSubmissionData = {
          ...submissionData,
          assignedWordSearchIndex: progressResult.rows[0].game_state.assignedWordSearchIndex
        };
      }
    } else if (game.type === 'wordle' || game.type === 'wordle_advanced' || game.type === 'wordle_bank') {
      const progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
      // 'assignedWord' is used by resolveGameData for these types
      if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedWord) {
        finalSubmissionData = {
          ...submissionData,
          solution: progressResult.rows[0].game_state.assignedWord
        };
      }
    } else if (game.type === 'verse_scramble') {
      const progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
      if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedVerse) {
        finalSubmissionData = {
          ...submissionData,
          verse: progressResult.rows[0].game_state.assignedVerse.verse,
          reference: progressResult.rows[0].game_state.assignedVerse.reference
        };
      }
    } else if (game.type === 'who_am_i') {
      if (gameData.answer) {
        finalSubmissionData = {
          ...submissionData,
          answer: gameData.answer,
          hint: gameData.hint
        };
      }
    }

    const existingSub = await pool.query('SELECT * FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, gameId]);

    if (existingSub.rows.length > 0) {
      // Only update if new score is better
      if (score > existingSub.rows[0].score) {
        const result = await pool.query(
          'UPDATE game_submissions SET started_at = $1, completed_at = $2, time_taken = $3, mistakes = $4, score = $5, submission_data = $6 WHERE id = $7 RETURNING *',
          [startedAt, new Date(), timeTaken, calculatedMistakes, score, JSON.stringify(finalSubmissionData), existingSub.rows[0].id]
        );
        return res.json({ ...mapSubmission(result.rows[0]), feedback });
      } else {
        return res.json(mapSubmission(existingSub.rows[0]));
      }
    }

    const submissionId = `sub-${Date.now()}`;
    const result = await pool.query(
      'INSERT INTO game_submissions (id, user_id, game_id, challenge_id, started_at, completed_at, time_taken, mistakes, score, submission_data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [submissionId, userId, gameId, game.challenge_id, startedAt, new Date(), timeTaken, calculatedMistakes, score, JSON.stringify(finalSubmissionData)]
    );
    res.json({ ...mapSubmission(result.rows[0]), feedback });

  } catch (error) {
    console.error('Submit game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
