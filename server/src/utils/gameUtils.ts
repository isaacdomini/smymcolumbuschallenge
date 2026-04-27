import pool from '../db/pool.js';
import { getFeatureFlag } from './featureFlags.js';

export const getTodayEST = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
};

export const shuffleArray = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export const calculateScore = (game: any, submissionData: any, timeTaken: number, mistakes: number): number => {
  let baseScore = 0;
  const gameType = game.type;

  switch (gameType) {
    case 'wordle':
    case 'wordle_advanced': {
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
    case 'match_the_word': {
      const foundPairsCount = submissionData?.foundPairsCount ?? 0;
      const pairScore = foundPairsCount * 20;
      const mistakePenalty = mistakes * 10;
      baseScore = Math.max(0, pairScore - mistakePenalty);
      break;
    }
    case 'verse_scramble': {
      if (!submissionData?.completed) {
        baseScore = 0;
      } else {
        // Max 80 points (20 base + 60 time bonus).
        // Formula: 20 + Math.max(0, 60 - (timeTaken / 10)).
        // 0s: 20 + 60 = 80.
        // 600s (10m): 20 + 0 = 20.
        // >600s: 20 + 0 = 20.
        const timeBonus = Math.max(0, 60 - (timeTaken / 10));
        baseScore = Math.round(20 + timeBonus);
      }
      break;
    }
    case 'wordle':
    case 'wordle_advanced':
    case 'wordle_bank': {
      const maxGuesses = 6;
      if (mistakes >= maxGuesses) {
        baseScore = 0;
      } else {
        baseScore = (maxGuesses - mistakes) * 10;
      }
      break;
    }
    case 'who_am_i': {
      const maxGuesses = 6;
      if (mistakes >= maxGuesses) {
        baseScore = 0;
      } else {
        baseScore = (maxGuesses - mistakes) * 10;
      }
      break;
    }
    case 'word_search': {
      const wordsFound = submissionData?.wordsFound ?? 0;
      const totalWords = submissionData?.totalWords ?? 5;
      const wordScore = wordsFound * 10;
      const completionBonus = (wordsFound === totalWords) ? 20 : 0;
      const timeBonus = Math.max(0, 30 - Math.floor(timeTaken / 20));
      baseScore = wordScore + completionBonus + timeBonus;
      break;
    }
    case 'book_guesser':
    case 'property_matcher': {
      // Wrong answer always scores 0
      if (!submissionData?.solved) {
        baseScore = 0;
      } else {
        const maxMistakes = 6;
        const remainingGuesses = Math.max(0, maxMistakes - mistakes);
        const guessBonus = remainingGuesses * 5;
        const timeBonus = Math.max(0, 20 - Math.floor(timeTaken / 15));
        baseScore = 50 + guessBonus + timeBonus;
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
  // game.date is a Date object from the DB, e.g., 2025-11-15 00:00:00 UTC
  // We need its UTC date string.
  const gameDateStr = new Date(game.date).toISOString().split('T')[0]; // "2025-11-15"
  const gameDate = new Date(gameDateStr + 'T12:00:00Z'); // Noon UTC on that day

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

export const resolveGameData = async (game: any, userId?: string, stripSolution: boolean = true) => {
  console.log('resolveGameData called for game:', game.id, 'type:', game.type, 'userId:', userId);
  let gameData = game.data;
  let gameType = game.type;

  // --- FEATURE FLAG: Revisit Block ---
  if (userId) {
    const isCompletedResult = await pool.query('SELECT 1 FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
    if (isCompletedResult.rows.length > 0) {
      const allowRevisit = await getFeatureFlag('allow_game_revisit');
      if (!allowRevisit) {
        // Mask the game data completely
        return {
          id: game.id,
          challengeId: game.challenge_id,
          date: game.date,
          type: gameType,
          data: {}, // clear data
          revisitBlocked: true
        };
      }
    }
  }
  // -----------------------------------

  if (gameType === 'wordle_advanced' || gameType === 'wordle_bank') {
    // Mask as 'wordle' so frontend doesn't know the difference
    const isBank = gameType === 'wordle_bank';
    gameType = 'wordle';

    if (userId) {
      let assignedWord;

      // 1. Check if the user has already submitted this specific game
      const submissionResult = await pool.query('SELECT submission_data FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, game.id]);

      if (submissionResult.rows.length > 0) {
        const submissionData = submissionResult.rows[0].submission_data;
        if (submissionData && submissionData.solution) {
          assignedWord = submissionData.solution;
        }
      }

      // 2. If not found in submission, check game_progress
      if (!assignedWord) {
        let progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);

        if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedWord) {
          assignedWord = progressResult.rows[0].game_state.assignedWord;
        } else {
          // No word assigned yet. Pick one safely.
          let solutions = gameData.solutions || [];

          if (isBank) {
            // WORDLE BANK LOGIC: Fetch centralized bank from challenge
            const challengeResult = await pool.query('SELECT word_bank FROM challenges WHERE id = $1', [game.challenge_id]);
            if (challengeResult.rows.length > 0 && challengeResult.rows[0].word_bank) {
              solutions = challengeResult.rows[0].word_bank;
            } else {
              // Fallback if challenge bank is empty
              solutions = ["FAITH", "GRACE", "JESUS", "MERCY", "PEACE", "TRUST", "GLORY", "TRUTH"];
            }
          }

          if (solutions.length > 0) {
            let candidateWord;

            if (isBank) {
              // WORDLE BANK LOGIC: Filter out used words
              // Get all words this user has ever played in wordle, wordle_advanced, or wordle_bank
              // We check game_submissions for completed games
              // And game_progress for ongoing games (assignedWord)

              const usedWordsResult = await pool.query(`
                 SELECT DISTINCT word FROM (
                   SELECT submission_data->>'solution' as word 
                   FROM game_submissions 
                   JOIN games ON game_submissions.game_id = games.id
                   WHERE user_id = $1 
                     AND (games.type = 'wordle' OR games.type = 'wordle_advanced' OR games.type = 'wordle_bank')
                     AND submission_data->>'solution' IS NOT NULL
                   
                   UNION
                   
                   SELECT game_state->>'assignedWord' as word
                   FROM game_progress
                   JOIN games ON game_progress.game_id = games.id
                   WHERE user_id = $1
                     AND (games.type = 'wordle' OR games.type = 'wordle_advanced' OR games.type = 'wordle_bank')
                     AND game_state->>'assignedWord' IS NOT NULL
                 ) as all_words
               `, [userId]);

              const usedWords = new Set(usedWordsResult.rows.map(r => r.word.toUpperCase()));
              const availableSolutions = solutions.filter((w: string) => !usedWords.has(w.toUpperCase()));

              if (availableSolutions.length > 0) {
                candidateWord = availableSolutions[Math.floor(Math.random() * availableSolutions.length)];
              } else {
                // Fallback if they played ALL words? Just pick random from full list to avoid crash.
                candidateWord = solutions[Math.floor(Math.random() * solutions.length)];
              }

            } else {
              // Standard Wordle Advanced: just pick random
              candidateWord = solutions[Math.floor(Math.random() * solutions.length)];
            }

            const progressId = `progress-${userId}-${game.id}`;
            const initialGameState = JSON.stringify({ assignedWord: candidateWord });

            await pool.query(
              `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at) 
               VALUES ($1, $2, $3, $4, NOW()) 
               ON CONFLICT (user_id, game_id) 
               DO UPDATE SET 
                 game_state = jsonb_set(COALESCE(game_progress.game_state, '{}'::jsonb), '{assignedWord}', to_jsonb($5::text)), 
                 updated_at = NOW()
               WHERE (game_progress.game_state->>'assignedWord') IS NULL`,
              [progressId, userId, game.id, initialGameState, candidateWord]
            );

            const finalResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
            if (finalResult.rows.length > 0 && finalResult.rows[0].game_state.assignedWord) {
              assignedWord = finalResult.rows[0].game_state.assignedWord;
            } else {
              assignedWord = candidateWord;
            }

          } else {
            assignedWord = "ERROR";
          }
        }
      }

      gameData = { ...gameData, solution: assignedWord };
      delete gameData.solutions;

    } else {
      const solutions = gameData.solutions || [];
      const assignedWord = solutions.length > 0 ? solutions[0] : "GUEST";
      gameData = { ...gameData, solution: assignedWord };
      delete gameData.solutions;
    }
  } else if (gameType === 'who_am_i' && gameData.solutions && gameData.solutions.length > 0) {
    // Handle Who Am I with multiple solutions
    if (userId) {
      let assignedSolution;

      // 1. Check submission
      const submissionResult = await pool.query('SELECT submission_data FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
      if (submissionResult.rows.length > 0) {
        const submissionData = submissionResult.rows[0].submission_data;
        // Check for 'answer' (new format) or 'solution' (just in case)
        if (submissionData && (submissionData.answer || submissionData.solution)) {
          assignedSolution = {
            answer: submissionData.answer || submissionData.solution,
            hint: submissionData.hint
          };
        }
      }

      // 2. Check progress
      if (!assignedSolution) {
        let progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);

        if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedWhoAmI) {
          assignedSolution = progressResult.rows[0].game_state.assignedWhoAmI;
        } else {
          // Assign new
          const solutions = gameData.solutions;
          const candidate = solutions[Math.floor(Math.random() * solutions.length)];

          const existingState = progressResult.rows.length > 0 ? progressResult.rows[0].game_state : {};
          const newState = { ...existingState, assignedWhoAmI: candidate };

          await pool.query(
            `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at) 
               VALUES ($1, $2, $3, $4, NOW()) 
               ON CONFLICT (user_id, game_id) DO UPDATE SET game_state = $4, updated_at = NOW()`,
            [`progress-${userId}-${game.id}`, userId, game.id, JSON.stringify(newState)]
          );
          assignedSolution = candidate;
        }
      }

      if (assignedSolution) {
        gameData = { ...gameData, ...assignedSolution };
        delete gameData.solutions;
      }
    } else {
      // Guest - pick random
      const solutions = gameData.solutions;
      const candidate = solutions[Math.floor(Math.random() * solutions.length)];
      gameData = { ...gameData, ...candidate };
      delete gameData.solutions;
    }

  } else if (gameType === 'connections') {
    if (userId) {
      let assignedCategories: string[] | undefined;

      // 1. Check submission
      const submissionResult = await pool.query('SELECT submission_data FROM game_submissions WHERE user_id = $1 AND game_id = $2 ORDER BY completed_at DESC LIMIT 1', [userId, game.id]);
      if (submissionResult.rows.length > 0) {
        const submissionData = submissionResult.rows[0].submission_data;
        if (submissionData) {
          if (submissionData.assignedCategories) {
            assignedCategories = submissionData.assignedCategories;
          } else if (submissionData.categories) {
            assignedCategories = submissionData.categories.map((c: any) => c.name);
          } else if (submissionData.foundGroups) {
            // Fallback for some submission formats
            assignedCategories = submissionData.foundGroups;
          }
        }
      }

      // 2. Check progress
      if (!assignedCategories) {
        let progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);

        if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedCategories) {
          assignedCategories = progressResult.rows[0].game_state.assignedCategories;
        } else {
          // Assign new
          const allCategories = gameData.categories;
          // Shuffle and pick 4
          // Shuffle and pick 4
          const shuffled = shuffleArray(allCategories);
          const selected = shuffled.slice(0, 4);
          assignedCategories = selected.map((c: any) => c.name);

          const existingState = progressResult.rows.length > 0 ? progressResult.rows[0].game_state : {};
          const newState = { ...existingState, assignedCategories };

          await pool.query(
            `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at) 
               VALUES ($1, $2, $3, $4, NOW()) 
               ON CONFLICT (user_id, game_id) DO UPDATE SET game_state = $4, updated_at = NOW()`,
            [`progress-${userId}-${game.id}`, userId, game.id, JSON.stringify(newState)]
          );
        }
      }

      if (assignedCategories) {
        const selectedCats = gameData.categories.filter((c: any) => assignedCategories!.includes(c.name));
        // Ensure we found them (in case of data mismatch), otherwise fallback
        if (selectedCats.length === 4) {
          gameData = {
            categories: selectedCats,
            words: selectedCats.flatMap((c: any) => c.words)
          };
        } else {
          // Fallback if names don't match
          const selected = gameData.categories.slice(0, 4);
          gameData = {
            categories: selected,
            words: selected.flatMap((c: any) => c.words)
          };
        }
      }
    } else {
      // Guest - just pick first 4
      const selected = gameData.categories.slice(0, 4);
      gameData = {
        categories: selected,
        words: selected.flatMap((c: any) => c.words)
      };
    }
  } else if (gameType === 'word_search' && gameData.puzzles && gameData.puzzles.length > 0) {
    // Handle Word Search with multiple puzzles
    if (userId) {
      let assignedPuzzle;

      // 1. Check submission
      const submissionResult = await pool.query('SELECT submission_data FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
      if (submissionResult.rows.length > 0) {
        const submissionData = submissionResult.rows[0].submission_data;
        if (submissionData && submissionData.assignedWordSearchIndex !== undefined) {
          const index = submissionData.assignedWordSearchIndex;
          if (gameData.puzzles[index]) {
            assignedPuzzle = gameData.puzzles[index];
          }
        }
      }

      // 2. Check progress
      if (!assignedPuzzle) {
        let progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);

        if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedWordSearchIndex !== undefined) {
          const index = progressResult.rows[0].game_state.assignedWordSearchIndex;
          if (gameData.puzzles[index]) {
            assignedPuzzle = gameData.puzzles[index];
          }
        }

        if (!assignedPuzzle) {
          // Assign new (safely)
          const puzzles = gameData.puzzles;
          const randomIndex = Math.floor(Math.random() * puzzles.length);

          const progressId = `progress-${userId}-${game.id}`;
          const initialGameState = JSON.stringify({ assignedWordSearchIndex: randomIndex });

          await pool.query(
            `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (user_id, game_id) 
             DO UPDATE SET 
               game_state = jsonb_set(COALESCE(game_progress.game_state, '{}'::jsonb), '{assignedWordSearchIndex}', to_jsonb($5::int)), 
               updated_at = NOW()
             WHERE (game_progress.game_state->>'assignedWordSearchIndex') IS NULL`,
            [progressId, userId, game.id, initialGameState, randomIndex]
          );

          // Re-fetch
          const finalResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
          if (finalResult.rows.length > 0 && finalResult.rows[0].game_state.assignedWordSearchIndex !== undefined) {
            const finalIndex = finalResult.rows[0].game_state.assignedWordSearchIndex;
            assignedPuzzle = puzzles[finalIndex];
          } else {
            assignedPuzzle = puzzles[randomIndex];
          }
        }
      }

      if (assignedPuzzle) {
        gameData = { ...assignedPuzzle };
      }
    } else {
      // Guest - pick random
      const puzzles = gameData.puzzles;
      const candidate = puzzles[Math.floor(Math.random() * puzzles.length)];
      gameData = { ...candidate };
    }
  } else if (gameType === 'crossword' && gameData.puzzles && gameData.puzzles.length > 0) {
    // Handle Crossword with multiple puzzles
    if (userId) {
      let assignedPuzzle;

      // 1. Check submission
      const submissionResult = await pool.query('SELECT submission_data FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
      if (submissionResult.rows.length > 0) {
        // If they submitted, they must have had a puzzle assigned.
        // We rely on game_progress or re-assign the same one if possible.
        const submissionData = submissionResult.rows[0].submission_data;

        // Prioritize index to ensure we get the full puzzle with answers (stored puzzle might be stripped)
        if (submissionData && submissionData.assignedCrosswordIndex !== undefined) {
          const index = submissionData.assignedCrosswordIndex;
          if (gameData.puzzles[index]) {
            assignedPuzzle = gameData.puzzles[index];
          }
        }

        if (!assignedPuzzle && submissionData && submissionData.puzzle) {
          assignedPuzzle = submissionData.puzzle;
        }
      }

      // 2. Check progress (primary source for assignment)
      if (!assignedPuzzle) {
        let progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);

        if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedCrosswordIndex !== undefined) {
          const index = progressResult.rows[0].game_state.assignedCrosswordIndex;
          if (gameData.puzzles[index]) {
            assignedPuzzle = gameData.puzzles[index];
          }
        }

        if (!assignedPuzzle) {
          // Assign new (safely handling concurrency)
          const puzzles = gameData.puzzles;
          const randomIndex = Math.floor(Math.random() * puzzles.length);

          const progressId = `progress-${userId}-${game.id}`;
          const initialGameState = JSON.stringify({ assignedCrosswordIndex: randomIndex });

          await pool.query(
            `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at) 
             VALUES ($1, $2, $3, $4, NOW()) 
             ON CONFLICT (user_id, game_id) 
             DO UPDATE SET 
               game_state = jsonb_set(COALESCE(game_progress.game_state, '{}'::jsonb), '{assignedCrosswordIndex}', to_jsonb($5::int)), 
               updated_at = NOW()
             WHERE (game_progress.game_state->>'assignedCrosswordIndex') IS NULL`,
            [progressId, userId, game.id, initialGameState, randomIndex]
          );

          // Fetch the definitive state
          const finalResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
          if (finalResult.rows.length > 0 && finalResult.rows[0].game_state.assignedCrosswordIndex !== undefined) {
            const finalIndex = finalResult.rows[0].game_state.assignedCrosswordIndex;
            assignedPuzzle = puzzles[finalIndex];
          } else {
            // Should not happen, but safe fallback
            assignedPuzzle = puzzles[randomIndex];
          }
        }
      }

      if (assignedPuzzle) {
        gameData = { ...assignedPuzzle };
      }
    } else {
      // Guest - pick random
      const puzzles = gameData.puzzles;
      const candidate = puzzles[Math.floor(Math.random() * puzzles.length)];
      gameData = { ...candidate };
    }
  } else if ((gameType === 'wordle' || gameType === 'wordle_advanced') && gameData.solutions && gameData.solutions.length > 0) {
    if (userId) {
      console.log('Resolving Wordle for user:', userId);
      let assignedSolution;
      // Check submission
      const submissionResult = await pool.query('SELECT submission_data FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
      if (submissionResult.rows.length > 0) {
        const submissionData = submissionResult.rows[0].submission_data;
        if (submissionData && submissionData.solution) {
          assignedSolution = submissionData.solution;
        }
      }
      // Check progress
      if (!assignedSolution) {
        let progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
        if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedSolution) {
          assignedSolution = progressResult.rows[0].game_state.assignedSolution;
        } else {
          // Assign new
          console.log('Assigning new solution...');
          const solutions = gameData.solutions;
          assignedSolution = solutions[Math.floor(Math.random() * solutions.length)];
          const existingState = progressResult.rows.length > 0 ? progressResult.rows[0].game_state : {};
          const newState = { ...existingState, assignedSolution };
          console.log('Saving new state:', newState);
          await pool.query(
            `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    ON CONFLICT (user_id, game_id) DO UPDATE SET game_state = $4, updated_at = NOW()`,
            [`progress-${userId}-${game.id}`, userId, game.id, JSON.stringify(newState)]
          );
        }
      }
      if (assignedSolution) {
        gameData = { ...gameData, solution: assignedSolution };
        delete gameData.solutions;
      }
    } else {
      // Guest
      gameData = { ...gameData, solution: gameData.solutions[0] };
      delete gameData.solutions;
    }
  } else if (gameType === 'verse_scramble' && gameData.verses && gameData.verses.length > 0) {
    // Handle Verse Scramble with multiple verses
    if (userId) {
      let assignedVerse;

      // 1. Check submission
      const submissionResult = await pool.query('SELECT submission_data FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
      if (submissionResult.rows.length > 0) {
        const submissionData = submissionResult.rows[0].submission_data;
        if (submissionData && (submissionData.verse || submissionData.reference)) {
          assignedVerse = {
            verse: submissionData.verse,
            reference: submissionData.reference
          };
        }
      }

      // 2. Check progress
      if (!assignedVerse) {
        let progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);

        if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedVerse) {
          assignedVerse = progressResult.rows[0].game_state.assignedVerse;
        } else {
          // Assign new
          const verses = gameData.verses;
          const candidate = verses[Math.floor(Math.random() * verses.length)];

          const existingState = progressResult.rows.length > 0 ? progressResult.rows[0].game_state : {};
          const newState = { ...existingState, assignedVerse: candidate };

          await pool.query(
            `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at) 
               VALUES ($1, $2, $3, $4, NOW()) 
               ON CONFLICT (user_id, game_id) DO UPDATE SET game_state = $4, updated_at = NOW()`,
            [`progress-${userId}-${game.id}`, userId, game.id, JSON.stringify(newState)]
          );
          assignedVerse = candidate;
        }
      }

      if (assignedVerse) {
        gameData = { ...gameData, verse: assignedVerse.verse, reference: assignedVerse.reference };
        delete gameData.verses;
      }

    } else {
      // Guest
      const candidate = gameData.verses[0];
      gameData = { ...gameData, verse: candidate.verse, reference: candidate.reference };
      delete gameData.verses;
    }
  } else if (gameType === 'match_the_word' && gameData.pairs && gameData.pairs.length > 6) {
    // Handle Match The Word with > 6 pairs
    if (userId) {
      let assignedPairs: string[] | undefined;

      // 1. Check submission
      const submissionResult = await pool.query('SELECT submission_data FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
      if (submissionResult.rows.length > 0) {
        const submissionData = submissionResult.rows[0].submission_data;
        if (submissionData && submissionData.assignedPairs) {
          assignedPairs = submissionData.assignedPairs;
        }
      }

      // 2. Check progress
      if (!assignedPairs) {
        let progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);

        if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedPairs) {
          assignedPairs = progressResult.rows[0].game_state.assignedPairs;
        } else {
          // Assign new 6 pairs
          const allPairs = gameData.pairs;
          // Shuffle and pick 6
          const shuffled = shuffleArray(allPairs);
          const selected = shuffled.slice(0, 6);
          assignedPairs = selected.map((p: any) => p.word);

          const existingState = progressResult.rows.length > 0 ? progressResult.rows[0].game_state : {};
          const newState = { ...existingState, assignedPairs };

          await pool.query(
            `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at) 
               VALUES ($1, $2, $3, $4, NOW()) 
               ON CONFLICT (user_id, game_id) DO UPDATE SET game_state = $4, updated_at = NOW()`,
            [`progress-${userId}-${game.id}`, userId, game.id, JSON.stringify(newState)]
          );
        }
      }

      if (assignedPairs) {
        const selectedPairs = gameData.pairs.filter((p: any) => assignedPairs!.includes(p.word));
        // Ensure we found them (in case of data mismatch), otherwise fallback
        if (selectedPairs.length === 6) {
          gameData = {
            pairs: selectedPairs
          };
        } else {
          // Fallback if names don't match
          const selected = gameData.pairs.slice(0, 6);
          gameData = {
            pairs: selected
          };
        }
      }

    } else {
      // Guest - just pick first 6
      const selected = gameData.pairs.slice(0, 6);
      gameData = {
        pairs: selected
      };
    }

  } else if (gameType === 'who_am_i' && gameData.solutions && gameData.solutions.length > 0) {
    if (userId) {
      let assignedSolution;
      // Check submission
      const submissionResult = await pool.query('SELECT submission_data FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
      if (submissionResult.rows.length > 0) {
        const submissionData = submissionResult.rows[0].submission_data;
        if (submissionData && submissionData.answer) {
          assignedSolution = { answer: submissionData.answer, hint: submissionData.hint };
        }
      }
      // Check progress
      if (!assignedSolution) {
        let progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
        if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedSolution) {
          assignedSolution = progressResult.rows[0].game_state.assignedSolution;
        } else {
          // Assign new
          const solutions = gameData.solutions;
          assignedSolution = solutions[Math.floor(Math.random() * solutions.length)];
          const existingState = progressResult.rows.length > 0 ? progressResult.rows[0].game_state : {};
          const newState = { ...existingState, assignedSolution };
          await pool.query(
            `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    ON CONFLICT (user_id, game_id) DO UPDATE SET game_state = $4, updated_at = NOW()`,
            [`progress-${userId}-${game.id}`, userId, game.id, JSON.stringify(newState)]
          );
        }
      }
      if (assignedSolution) {
        gameData = { ...gameData, answer: assignedSolution.answer, hint: assignedSolution.hint };
        delete gameData.solutions;
      }
    } else {
      // Guest
      const sol = gameData.solutions[0];
      gameData = { ...gameData, answer: sol.answer, hint: sol.hint };
      delete gameData.solutions;
    }
  } else if (gameType === 'word_search' && gameData.puzzles && gameData.puzzles.length > 0) {
    if (userId) {
      let assignedPuzzle;
      // Check submission
      const submissionResult = await pool.query('SELECT submission_data FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
      if (submissionResult.rows.length > 0) {
        const submissionData = submissionResult.rows[0].submission_data;
        // Reconstruct puzzle from submission if possible, or just rely on progress?
        // Word Search submission might not store the whole grid.
        // Let's rely on progress or re-assignment (if deterministic enough).
        // Actually, if submitted, we might not need to re-assign for gameplay, but for review.
        // Let's check progress first as it's more reliable for "what was assigned".
      }

      // Check progress
      if (!assignedPuzzle) {
        let progressResult = await pool.query('SELECT game_state FROM game_progress WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
        if (progressResult.rows.length > 0 && progressResult.rows[0].game_state.assignedWordSearchIndex !== undefined) {
          const idx = progressResult.rows[0].game_state.assignedWordSearchIndex;
          if (gameData.puzzles[idx]) {
            assignedPuzzle = gameData.puzzles[idx];
          }
        } else {
          // Assign new
          const puzzles = gameData.puzzles;
          const idx = Math.floor(Math.random() * puzzles.length);
          assignedPuzzle = puzzles[idx];
          const existingState = progressResult.rows.length > 0 ? progressResult.rows[0].game_state : {};
          const newState = { ...existingState, assignedWordSearchIndex: idx };
          await pool.query(
            `INSERT INTO game_progress (id, user_id, game_id, game_state, updated_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    ON CONFLICT (user_id, game_id) DO UPDATE SET game_state = $4, updated_at = NOW()`,
            [`progress-${userId}-${game.id}`, userId, game.id, JSON.stringify(newState)]
          );
        }
      }
      if (assignedPuzzle) {
        gameData = { ...gameData, grid: assignedPuzzle.grid, words: assignedPuzzle.words };
        delete gameData.puzzles;
      }
    } else {
      // Guest
      const puzzle = gameData.puzzles[0];
      gameData = { ...gameData, grid: puzzle.grid, words: puzzle.words };
      delete gameData.puzzles;
    }
  }

  // Check if user has submitted to potentially allow solution reveal
  let hasSubmitted = false;
  if (userId) {
    const subCheck = await pool.query('SELECT id FROM game_submissions WHERE user_id = $1 AND game_id = $2', [userId, game.id]);
    hasSubmitted = subCheck.rows.length > 0;
  }

  // Strip solutions if requested
  if (stripSolution) {
    if (gameType === 'wordle' || gameType === 'wordle_advanced' || gameType === 'wordle_bank') {
      if (gameData.solution) {
        gameData.wordLength = gameData.solution.length;
        // Reveal solution if submitted
        if (!hasSubmitted) {
          delete gameData.solution;
        }
      }
    } else if (gameType === 'connections') {
      if (gameData.categories) {
        const allWords = gameData.categories.flatMap((c: any) => c.words);
        gameData.shuffledWords = shuffleArray(allWords);

        // Only strip categories if user hasn't submitted
        if (!hasSubmitted) {
          gameData.words = gameData.shuffledWords;
          delete gameData.categories;
          delete gameData.shuffledWords;
        } else {
          // If submitted, we might still want shuffledWords provided as 'words' for consistency, but keep categories
          gameData.words = gameData.shuffledWords;
          // Keep categories!
        }
      }

    } else if (gameType === 'match_the_word') {
      if (gameData.pairs) {
        gameData.shuffledWords = shuffleArray(gameData.pairs.map((p: any) => p.word));
        gameData.shuffledMatches = shuffleArray(gameData.pairs.map((p: any) => p.match));
        // delete gameData.pairs; // Frontend needs pairs to reconstruct lines on load
      }
    } else if (gameType === 'verse_scramble') {
      if (gameData.verse) {
        gameData.scrambledWords = shuffleArray(gameData.verse.split(' '));
        delete gameData.verse;
        // Keep reference? Yes.
      }
    } else if (gameType === 'who_am_i') {
      if (gameData.answer) {
        gameData.wordLength = gameData.answer.length;
        gameData.maskedAnswer = gameData.answer.replace(/[a-zA-Z0-9]/g, '_');
        delete gameData.answer;
        // Keep hint
      }
    } else if (gameType === 'crossword') {
      // Strip answers from clues
      if (gameData.acrossClues) {
        gameData.acrossClues = gameData.acrossClues.map((c: any) => {
          const { answer, ...rest } = c;
          return { ...rest, length: answer ? answer.length : 0 };
        });
      }
      if (gameData.downClues) {
        gameData.downClues = gameData.downClues.map((c: any) => {
          const { answer, ...rest } = c;
          return { ...rest, length: answer ? answer.length : 0 };
        });
      }
    }
  }

  return {
    id: game.id,
    challengeId: game.challenge_id,
    date: game.date.toISOString(),
    type: gameType,
    data: gameData,
  };
};

